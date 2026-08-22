export type ModelProvider =
  | "replicate"
  | "cursor"
  | "gemini"
  | "groq"
  | "openai"
  | "openrouter"
  | "gateway"
  | "ollama";

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
  cursor: {
    label: "Cursor",
    model: "composer-2.5",
    hint: "cursor.com/dashboard/integrations",
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
};

const STORAGE_KEY = "econ-model-settings";

export function defaultModelSettings(): ModelSettings {
  return {
    provider: "replicate",
    apiKey: "",
    model: PROVIDER_DEFAULTS.replicate.model,
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
    const provider = parsed.provider ?? fallback.provider;
    const defaults = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.replicate;
    return {
      provider: defaults ? provider : "replicate",
      apiKey: parsed.apiKey ?? "",
      model:
        parsed.model && parsed.model !== "gemini-2.5-flash"
          ? parsed.model
          : defaults.model,
    };
  } catch {
    return fallback;
  }
}

export function saveModelSettings(settings: ModelSettings): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export interface AgentStatus {
  env: Record<ModelProvider, boolean>;
  ollama: { up: boolean; models: string[] };
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
  return status.env[provider];
}

/**
 * The provider the panel should open on, so a user who has configured exactly
 * one of these does not have to find it in the dropdown. On-device Ollama comes
 * last because it is the weakest planner.
 */
export function preferredProvider(status: AgentStatus | null): ModelProvider | null {
  if (!status) {
    return null;
  }
  const order: ModelProvider[] = [
    status.defaultProvider,
    "replicate",
    "gemini",
    "cursor",
    "groq",
    "openai",
    "openrouter",
    "gateway",
    "ollama",
  ];
  return order.find((provider) => providerHasServerKey(status, provider)) ?? null;
}

export function hasStoredModelSettings(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
