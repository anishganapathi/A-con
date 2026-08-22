export type ModelProvider =
  | "replicate"
  | "gemini"
  | "groq"
  | "openai"
  | "openrouter"
  | "gateway"
  | "ollama"
  | "local";

export interface ModelSettings {
  provider: ModelProvider;
  apiKey: string;
  model: string;
}

export const PROVIDER_DEFAULTS: Record<
  ModelProvider,
  { label: string; model: string; hint: string }
> = {
  replicate: {
    label: "Replicate · Gemini 3.5 Flash",
    model: "google/gemini-3.5-flash",
    hint: "replicate.com/account/api-tokens",
  },
  gemini: {
    label: "Gemini (via Replicate)",
    model: "google/gemini-3.5-flash",
    hint: "Uses REPLICATE_API_TOKEN — same as Replicate",
  },
  groq: {
    label: "Groq",
    model: "llama-3.3-70b-versatile",
    hint: "Free test key at console.groq.com",
  },
  openai: {
    label: "OpenAI",
    model: "gpt-4.1-mini",
    hint: "platform.openai.com",
  },
  openrouter: {
    label: "OpenRouter",
    model: "openai/gpt-4.1-mini",
    hint: "openrouter.ai",
  },
  gateway: {
    label: "Vercel Gateway",
    model: "openai/gpt-5.4",
    hint: "AI_GATEWAY_API_KEY",
  },
  ollama: {
    label: "Ollama (on-device)",
    model: "llama3.2",
    hint: "localhost:11434 — no key",
  },
  local: {
    label: "Local VL · GB10",
    model: "Qwen3VL-30B-A3B-Instruct-Q4_K_M.gguf",
    hint: "10.0.1.20:8080 — no key",
  },
};

const STORAGE_KEY = "econ-model-settings";

export function defaultModelSettings(): ModelSettings {
  return {
    provider: "local",
    apiKey: "",
    model: PROVIDER_DEFAULTS.local.model,
  };
}

export function loadModelSettings(): ModelSettings {
  const fallback = defaultModelSettings();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<ModelSettings>;
    // A session saved against a provider that no longer exists must not pin the
    // chat to something the server can no longer run.
    const known = parsed.provider && PROVIDER_DEFAULTS[parsed.provider];
    const provider = known ? (parsed.provider as ModelProvider) : fallback.provider;
    const defaults = PROVIDER_DEFAULTS[provider];
    return {
      provider,
      apiKey: known ? (parsed.apiKey ?? "") : "",
      model:
        known && parsed.model && parsed.model !== "gemini-2.5-flash"
          ? parsed.model
          : defaults.model,
    };
  } catch {
    return fallback;
  }
}

export interface AgentStatus {
  env: Record<ModelProvider, boolean>;
  ollama: { up: boolean; models: string[] };
  local?: { up: boolean; models: string[]; url: string };
  defaultProvider: ModelProvider;
}

export function providerHasServerKey(
  status: AgentStatus | null,
  provider: ModelProvider,
): boolean {
  if (!status) {
    return false;
  }
  if (provider === "ollama") {
    return status.ollama.up;
  }
  if (provider === "local") {
    return Boolean(status.local?.up || status.env.local);
  }
  return status.env[provider];
}

/**
 * The provider the chat runs on. There is no picker in the UI, so this follows
 * whatever the server reports it can serve. The local VL box leads because it
 * is the planner this app is built around; on-device Ollama comes last because
 * it is the weakest.
 */
export function preferredProvider(status: AgentStatus | null): ModelProvider | null {
  if (!status) {
    return null;
  }
  const order: ModelProvider[] = [
    status.defaultProvider,
    "local",
    "replicate",
    "gemini",
    "groq",
    "openai",
    "openrouter",
    "gateway",
    "ollama",
  ];
  return order.find((provider) => providerHasServerKey(status, provider)) ?? null;
}
