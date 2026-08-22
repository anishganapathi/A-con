import { describe, expect, test } from "vitest";
import { preferredProvider, type AgentStatus, type ModelProvider } from "./modelSettings";

function status(
  env: Partial<Record<ModelProvider, boolean>>,
  options: { ollamaUp?: boolean; defaultProvider?: ModelProvider } = {},
): AgentStatus {
  return {
    env: {
      replicate: false,
      gemini: false,
      groq: false,
      openai: false,
      openrouter: false,
      gateway: false,
      ollama: false,
      local: false,
      ...env,
    },
    ollama: { up: options.ollamaUp ?? false, models: [] },
    defaultProvider: options.defaultProvider ?? "replicate",
  };
}

describe("preferredProvider", () => {
  test("keeps the server's stated default when it can be served", () => {
    expect(preferredProvider(status({ gemini: true }, { defaultProvider: "gemini" }))).toBe(
      "gemini",
    );
  });

  test("picks the local VL box over an unusable default", () => {
    expect(preferredProvider(status({ local: true }, { defaultProvider: "replicate" }))).toBe(
      "local",
    );
  });

  test("runs on the local VL box ahead of a hosted key", () => {
    // Nothing is pinned and the stated default cannot be served, so the order
    // decides — and the VL box is what this app plans with.
    expect(
      preferredProvider(
        status({ local: true, replicate: true, gemini: true }, { defaultProvider: "ollama" }),
      ),
    ).toBe("local");
  });

  test("still honours a provider the server pinned", () => {
    expect(
      preferredProvider(
        status({ local: true, groq: true }, { defaultProvider: "groq" }),
      ),
    ).toBe("groq");
  });

  test("falls back to ollama when it is the only thing up", () => {
    expect(preferredProvider(status({}, { ollamaUp: true }))).toBe("ollama");
  });

  test("reports nothing when no provider is reachable", () => {
    expect(preferredProvider(status({}))).toBeNull();
  });

  test("reports nothing before status has loaded", () => {
    expect(preferredProvider(null)).toBeNull();
  });

  test("prefers a hosted model over on-device ollama", () => {
    expect(preferredProvider(status({ gemini: true }, { ollamaUp: true }))).toBe("gemini");
  });
});
