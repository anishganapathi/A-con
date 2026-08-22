import { describe, expect, test } from "vitest";
import { preferredProvider, type AgentStatus, type ModelProvider } from "./modelSettings";

function status(
  env: Partial<Record<ModelProvider, boolean>>,
  options: { ollamaUp?: boolean; defaultProvider?: ModelProvider } = {},
): AgentStatus {
  return {
    env: {
      replicate: false,
      cursor: false,
      gemini: false,
      groq: false,
      openai: false,
      openrouter: false,
      gateway: false,
      ollama: false,
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

  test("picks a signed-in cursor over an unusable default", () => {
    expect(preferredProvider(status({ cursor: true }, { defaultProvider: "replicate" }))).toBe(
      "cursor",
    );
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
