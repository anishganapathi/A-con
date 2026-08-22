import { describe, expect, test } from "vitest";
import {
  envFlags,
  pickOllamaModel,
  replicateModelPath,
  resolveConfig,
  SYSTEM_PROMPT,
} from "./modelProviders";

describe("replicateModelPath", () => {
  test("runs the model that was configured", () => {
    expect(replicateModelPath("google/gemini-3.5-flash")).toBe("google/gemini-3.5-flash");
    expect(replicateModelPath("meta/meta-llama-3-70b-instruct")).toBe(
      "meta/meta-llama-3-70b-instruct",
    );
  });

  test("falls back to gemini when no model is given", () => {
    expect(replicateModelPath("")).toContain("gemini");
    expect(replicateModelPath(undefined)).toContain("gemini");
  });

  test("ignores a name that is not owner/model", () => {
    // A bare "llama3.2" or a versioned ref would 404 the predictions endpoint.
    expect(replicateModelPath("llama3.2")).toContain("gemini");
    expect(replicateModelPath("a/b/c")).toContain("gemini");
  });
});

describe("pickOllamaModel", () => {
  const installed = ["llama3.2:latest", "qwen2.5-coder:7b"];

  test("uses the requested model when it is pulled", () => {
    expect(pickOllamaModel("qwen2.5-coder:7b", undefined, installed)).toBe("qwen2.5-coder:7b");
  });

  test("matches a bare name against a tagged install", () => {
    expect(pickOllamaModel("llama3.2", undefined, installed)).toBe("llama3.2:latest");
  });

  test("ignores a request for a model that is not pulled", () => {
    expect(installed).toContain(pickOllamaModel("gpt-4.1", undefined, installed));
  });

  test("falls back to the configured default when it is pulled", () => {
    expect(pickOllamaModel(undefined, "qwen2.5-coder:7b", installed)).toBe("qwen2.5-coder:7b");
  });

  test("picks something pulled when neither request nor default is available", () => {
    expect(pickOllamaModel(undefined, "not-pulled", installed)).toBe("llama3.2:latest");
  });

  test("still names a model when ollama has none", () => {
    expect(pickOllamaModel(undefined, undefined, [])).toBeTruthy();
  });
});

describe("gemini model credentials", () => {
  test("needs a replicate token", () => {
    expect(resolveConfig({}, { provider: "gemini" })).toBeNull();
  });

  test("runs gemini on replicate when a token is present", () => {
    const config = resolveConfig({ REPLICATE_API_TOKEN: "r8_test" }, { provider: "gemini" });

    expect(config?.apiKey).toBe("r8_test");
    expect(config?.model).toContain("gemini");
  });
});

describe("local VL provider", () => {
  test("needs no key", () => {
    const config = resolveConfig(
      { ECON_AGENT_PROVIDER: "local", ECON_LOCAL_LLM_URL: "http://10.0.1.20:8080/v1" },
      { provider: "local" },
    );
    expect(config?.provider).toBe("local");
    expect(config?.baseUrl).toBe("http://10.0.1.20:8080/v1");
    expect(config?.model).toMatch(/Qwen3VL/);
  });

  test("is available when the GB10 URL is set", () => {
    expect(envFlags({ ECON_LOCAL_LLM_URL: "http://10.0.1.20:8080/v1" }).local).toBe(true);
  });

  test("is chosen over a hosted key when the box is configured", () => {
    const config = resolveConfig({
      ECON_LOCAL_LLM_URL: "http://10.0.1.20:8080/v1",
      REPLICATE_API_TOKEN: "r8_test",
    });

    expect(config?.provider).toBe("local");
    expect(config?.model).toMatch(/Qwen3VL/);
  });

  test("has no cursor provider left to fall back to", () => {
    expect(envFlags({ CURSOR_API_KEY: "sk-test" })).not.toHaveProperty("cursor");
    expect(resolveConfig({ CURSOR_API_KEY: "sk-test" })).toBeNull();
  });
});

describe("SYSTEM_PROMPT", () => {
  test("asks for an outline polygon in metres", () => {
    expect(SYSTEM_PROMPT).toMatch(/footprint/);
    expect(SYSTEM_PROMPT).toMatch(/counter-clockwise/i);
  });

  test("says when an outline beats width and depth", () => {
    expect(SYSTEM_PROMPT).toMatch(/L-shaped|non-rectangular/i);
  });

  test("asks for massing bands so towers can set back", () => {
    expect(SYSTEM_PROMPT).toMatch(/massing/);
    expect(SYSTEM_PROMPT).toMatch(/minHeight/);
    expect(SYSTEM_PROMPT).toMatch(/maxHeight/);
  });

  test("asks for the structural tip of a spire", () => {
    expect(SYSTEM_PROMPT).toMatch(/tipHeight/);
  });

  test("still documents the simple box fields", () => {
    for (const field of ["width", "depth", "stories", "storyHeight", "zones"]) {
      expect(SYSTEM_PROMPT).toContain(field);
    }
  });
});
