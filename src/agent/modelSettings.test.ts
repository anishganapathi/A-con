import { describe, expect, test } from "vitest";
import {
  preferredProvider,
  providerHasServerKey,
  type AgentStatus,
  type ModelProvider,
} from "./modelSettings";

function status(
  env: Partial<Record<ModelProvider, boolean>>,
  options: { ollamaUp?: boolean; localUp?: boolean; defaultProvider?: ModelProvider } = {},
): AgentStatus {
  const envLocal = env.local ?? false;
  const localUp = options.localUp ?? envLocal;
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
    local: { up: localUp, url: "http://10.0.1.20:8080/v1", models: [] },
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

  test("does not treat a configured-but-down GB10 as ready", () => {
    // .env can pin ECON_AGENT_PROVIDER=local while the box is off. That is a
    // wish, not a live planner — the chat must drop to heuristics, not fetch.
    const down = status({ local: true }, { localUp: false, defaultProvider: "local" });
    expect(providerHasServerKey(down, "local")).toBe(false);
    expect(preferredProvider(down)).toBeNull();
  });

  test("reports nothing before status has loaded", () => {
    expect(preferredProvider(null)).toBeNull();
  });

  test("prefers a hosted model over on-device ollama", () => {
    expect(preferredProvider(status({ gemini: true }, { ollamaUp: true }))).toBe("gemini");
  });
});
