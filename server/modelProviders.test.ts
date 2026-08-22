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

describe("cursor model credentials", () => {
  test("runs the cursor model from a stored SDK login with no key in the env", () => {
    const config = resolveConfig({}, { provider: "cursor" }, { cursorLogin: true });

    expect(config?.provider).toBe("cursor");
    expect(config?.model).toBeTruthy();
  });

  test("refuses cursor when there is neither a key nor a login", () => {
    expect(resolveConfig({}, { provider: "cursor" }, { cursorLogin: false })).toBeNull();
  });

  test("prefers an explicit cursor key over the stored login", () => {
    const config = resolveConfig(
      { CURSOR_API_KEY: "from-env" },
      { provider: "cursor" },
      { cursorLogin: true },
    );

    expect(config?.apiKey).toBe("from-env");
  });

  test("reports cursor as available once a login is stored", () => {
    expect(envFlags({}, { cursorLogin: true }).cursor).toBe(true);
    expect(envFlags({}).cursor).toBe(false);
  });

  test("autodetects the cursor model when only a login is present", () => {
    const config = resolveConfig({}, undefined, { cursorLogin: true });

    expect(config?.provider).toBe("cursor");
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

  test("prefers a replicate token over a stored cursor login", () => {
    const config = resolveConfig({ REPLICATE_API_TOKEN: "r8_test" }, undefined, {
      cursorLogin: true,
    });

    expect(config?.provider).toBe("replicate");
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
