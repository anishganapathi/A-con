import { describe, expect, test } from "vitest";
import {
  DEFAULT_LOCAL_LLM_URL,
  buildVisionUserContent,
  dropUnreachableLocal,
  editActionsOnly,
  explainLocalFetchError,
  imageDataUrls,
  localLlmBaseUrl,
  localLlmModel,
} from "./localLlm";

describe("local VL endpoint", () => {
  test("defaults to the GB10 llama.cpp box", () => {
    expect(localLlmBaseUrl({})).toBe(DEFAULT_LOCAL_LLM_URL);
  });

  test("adds /v1 when the user only gives the host", () => {
    expect(localLlmBaseUrl({ ECON_LOCAL_LLM_URL: "http://10.0.1.20:8080" })).toBe(
      "http://10.0.1.20:8080/v1",
    );
  });

  test("keeps a trailing-slash /v1 URL intact", () => {
    expect(localLlmBaseUrl({ ECON_LOCAL_LLM_URL: "http://10.0.1.20:8080/v1/" })).toBe(
      "http://10.0.1.20:8080/v1",
    );
  });

  test("uses the Qwen3-VL GGUF name unless another is set", () => {
    expect(localLlmModel({})).toMatch(/Qwen3VL/);
    expect(localLlmModel({ ECON_LOCAL_LLM_MODEL: "other.gguf" })).toBe("other.gguf");
  });

  test("drops a local config when the box did not answer the probe", () => {
    expect(
      dropUnreachableLocal(
        { provider: "local", apiKey: "", model: "qwen", baseUrl: DEFAULT_LOCAL_LLM_URL },
        { up: false, url: DEFAULT_LOCAL_LLM_URL, models: [] },
      ),
    ).toBeNull();
  });

  test("keeps a local config when the box is up", () => {
    const config = { provider: "local" as const, apiKey: "", model: "qwen", baseUrl: DEFAULT_LOCAL_LLM_URL };
    expect(dropUnreachableLocal(config, { up: true, url: DEFAULT_LOCAL_LLM_URL, models: [] })).toBe(
      config,
    );
  });

  test("names the box when fetch failed, instead of that raw TypeError", () => {
    const error = explainLocalFetchError(new TypeError("fetch failed"), DEFAULT_LOCAL_LLM_URL);
    expect(error.message).toMatch(/10\.0\.1\.20:8080/);
    expect(error.message).not.toBe("fetch failed");
  });
});

describe("vision payload", () => {
  test("sends the elevation as an image_url part", () => {
    const content = buildVisionUserContent({
      text: "Match this elevation",
      plan: "L3 Living Room",
      attachments: [{ name: "elev.png", type: "image/png", dataUrl: "data:image/png;base64,aaa" }],
    });
    expect(content).toEqual([
      { type: "text", text: expect.stringContaining("Match this elevation") },
      { type: "image_url", image_url: { url: "data:image/png;base64,aaa" } },
    ]);
  });

  test("ignores attachments that are not images", () => {
    expect(
      imageDataUrls([{ name: "a.pdf", type: "application/pdf", dataUrl: "data:application/pdf,x" }]),
    ).toEqual([]);
  });

  test("wraps a single action object so filter does not crash", () => {
    expect(editActionsOnly({ type: "patch_roof", patch: { ridgeHeight: 14 } })).toEqual([
      { type: "patch_roof", patch: { ridgeHeight: 14 } },
    ]);
  });

  test("strips replace_plan so a drawing cannot rebuild the model", () => {
    expect(
      editActionsOnly([
        { type: "replace_plan", plan: {}, note: "no" },
        { type: "patch_roof", patch: { visible: true } },
      ]),
    ).toEqual([{ type: "patch_roof", patch: { visible: true } }]);
  });
});
