import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type ServerProvider =
  | "replicate"
  | "cursor"
  | "gemini"
  | "groq"
  | "openai"
  | "openrouter"
  | "gateway"
  | "ollama";

const REPLICATE_MODEL = "google/gemini-3.5-flash";

export interface ProviderConfig {
  provider: ServerProvider;
  model: string;
  apiKey: string;
}

const SYSTEM_PROMPT = `You are E-kon's construction orchestrator using Gemini 3.5 Flash on Replicate.
Never invent Three.js, glTF, or meshes. Return JSON only.

If the user asks to build, create, or make a building — even by reference
("like Walmart", "Costco-style", "a clinic") — set agent to "construct" and
emit a specific spec. Do NOT emit a generic house unless they asked for a house.

Interpret the prompt literally:
- Walmart / Supercenter / Target / Costco = single-level big-box retail.
  ~60–90 m wide, 40–60 m deep, 6.5–8.5 m clear height, flat roof, metal panel
  exterior. Zones must include vestibule, checkout, grocery, HBA, apparel,
  electronics, home, restrooms, receiving / back-of-house. Optional garden or
  pharmacy if implied. Front of house on y=0.
- Warehouse / fulfillment = deep rack hall, dock, staging, small office.
- Office / HQ = lobby, open office, meeting, core, amenities.
- House / apartment = living, kitchen, bedrooms, bath, hall. Smaller plate.

spec.zones are axis-aligned rectangles in meters from the origin. They must
cover the plate without large empty holes. Each zone: id, name, x, y, w, h,
kind (entry|sales|service|back|wet|circulation|living|work).

{
  "agent": "construct" | "edit" | "extract" | "explain",
  "reply": "2–4 sentences naming the reference, size, departments, and height",
  "spec": {
    "name": "string",
    "reference": "Walmart Supercenter",
    "typology": "residential | retail | warehouse | office | civic",
    "width": 72,
    "depth": 48,
    "stories": 1,
    "storyHeight": 7.2,
    "roof": "flat | standing-seam",
    "exteriorColor": "#c8ccd1",
    "includeMep": true,
    "notes": "why this layout matches the prompt",
    "zones": [
      { "id": "vestibule", "name": "Vestibule", "x": 28, "y": 0, "w": 16, "h": 8, "kind": "entry" }
    ]
  },
  "actions": []
}

For edits only, omit spec and use actions against existing IDs from the plan
summary. Units are meters.`;

export function envFlags(env: Record<string, string>): Record<ServerProvider, boolean> {
  return {
    replicate: Boolean(env.REPLICATE_API_TOKEN || env.REPLICATE_API_KEY),
    cursor: Boolean(env.CURSOR_API_KEY),
    gemini: Boolean(env.REPLICATE_API_TOKEN || env.REPLICATE_API_KEY),
    groq: Boolean(env.GROQ_API_KEY),
    openai: Boolean(env.OPENAI_API_KEY),
    openrouter: Boolean(env.OPENROUTER_API_KEY),
    gateway: Boolean(env.AI_GATEWAY_API_KEY),
    ollama: false,
  };
}

export function resolveConfig(
  env: Record<string, string>,
  requested?: Partial<ProviderConfig>,
): ProviderConfig | null {
  const provider = (requested?.provider ??
    env.ECON_AGENT_PROVIDER ??
    firstAvailable(env)) as ServerProvider | undefined;
  if (!provider) {
    return null;
  }
  const apiKey =
    requested?.apiKey ||
    envKey(env, provider);
  if (provider !== "ollama" && !apiKey) {
    return null;
  }
  return {
    provider,
    apiKey,
    model: requested?.model || env.ECON_AGENT_MODEL || defaultModel(provider),
  };
}

export async function probeOllama(): Promise<{ up: boolean; models: string[] }> {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags");
    if (!response.ok) {
      return { up: false, models: [] };
    }
    const data = (await response.json()) as { models?: { name?: string }[] };
    return {
      up: true,
      models: (data.models ?? []).map((model) => model.name ?? "").filter(Boolean),
    };
  } catch {
    return { up: false, models: [] };
  }
}

export async function completeJson(
  config: ProviderConfig,
  userPayload: unknown,
): Promise<{ parsed: Record<string, unknown>; model: string; provider: ServerProvider }> {
  const user = JSON.stringify(userPayload);
  const content =
    config.provider === "cursor"
      ? await completeCursor(config, user)
      : config.provider === "replicate" || config.provider === "gemini"
        ? await completeReplicateGemini(config, user)
        : await completeOpenAiCompat(config, user);
  const parsed = parseModelJson(content);
  return { parsed, model: config.model, provider: config.provider };
}

function firstAvailable(env: Record<string, string>): ServerProvider | undefined {
  const flags = envFlags(env);
  const order: ServerProvider[] = [
    "replicate",
    "gemini",
    "cursor",
    "groq",
    "openai",
    "openrouter",
    "gateway",
    "ollama",
  ];
  return order.find((provider) => flags[provider]);
}

function envKey(env: Record<string, string>, provider: ServerProvider): string {
  if (provider === "replicate" || provider === "gemini") {
    return (
      env.REPLICATE_API_TOKEN || env.REPLICATE_API_KEY || ""
    );
  }
  if (provider === "cursor") {
    return env.CURSOR_API_KEY ?? "";
  }
  if (provider === "groq") {
    return env.GROQ_API_KEY ?? "";
  }
  if (provider === "openai") {
    return env.OPENAI_API_KEY ?? "";
  }
  if (provider === "openrouter") {
    return env.OPENROUTER_API_KEY ?? "";
  }
  if (provider === "gateway") {
    return env.AI_GATEWAY_API_KEY ?? "";
  }
  return "";
}

function defaultModel(provider: ServerProvider): string {
  if (provider === "replicate" || provider === "gemini") {
    return REPLICATE_MODEL;
  }
  if (provider === "cursor") {
    return "composer-2.5";
  }
  if (provider === "groq") {
    return "llama-3.3-70b-versatile";
  }
  if (provider === "openai") {
    return "gpt-4.1-mini";
  }
  if (provider === "openrouter") {
    return "openai/gpt-4.1-mini";
  }
  if (provider === "gateway") {
    return "openai/gpt-5.4";
  }
  return "llama3.2";
}

function endpoint(provider: ServerProvider): string {
  if (provider === "groq") {
    return "https://api.groq.com/openai/v1/chat/completions";
  }
  if (provider === "openai") {
    return "https://api.openai.com/v1/chat/completions";
  }
  if (provider === "openrouter") {
    return "https://openrouter.ai/api/v1/chat/completions";
  }
  if (provider === "gateway") {
    return "https://ai-gateway.vercel.sh/v1/chat/completions";
  }
  return "http://127.0.0.1:11434/v1/chat/completions";
}

async function completeOpenAiCompat(
  config: ProviderConfig,
  user: string,
): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = "http://localhost:5173";
    headers["X-Title"] = "E-kon";
  }
  const response = await fetch(endpoint(config.provider), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: user },
      ],
    }),
  });
  const payload = (await response.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Provider ${config.provider} returned ${response.status}`);
  }
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Provider returned an empty completion");
  }
  return content;
}

async function completeCursor(
  config: ProviderConfig,
  user: string,
): Promise<string> {
  const { Agent } = await import("@cursor/sdk");
  const cwd = await mkdtemp(join(tmpdir(), "econ-cursor-"));
  const result = await Agent.prompt(
    `${SYSTEM_PROMPT}\n\nCurrent request:\n${user}\n\nReply with the JSON object only. Do not edit files.`,
    {
      apiKey: config.apiKey,
      model: { id: config.model },
      name: "E-kon construction planner",
      tools: [],
      local: { cwd, settingSources: [] },
    },
  );
  if (result.status === "error") {
    throw new Error(result.error?.message ?? "Cursor agent failed");
  }
  if (!result.result) {
    throw new Error("Cursor returned an empty result");
  }
  return result.result;
}

interface ReplicatePrediction {
  id?: string;
  status?: string;
  error?: string | { message?: string };
  output?: unknown;
  urls?: { get?: string };
}

async function completeReplicateGemini(
  config: ProviderConfig,
  user: string,
): Promise<string> {
  const created = await fetch(
    `https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Prefer: "wait=60",
      },
      body: JSON.stringify({
        input: {
          prompt: user,
          system_instruction: SYSTEM_PROMPT,
          thinking_level: "low",
          temperature: 0.2,
          max_output_tokens: 8192,
        },
      }),
    },
  );
  let prediction = (await created.json()) as ReplicatePrediction;
  if (!created.ok) {
    throw new Error(replicateError(prediction) || `Replicate returned ${created.status}`);
  }
  const pollUrl = prediction.urls?.get;
  let attempts = 0;
  while (
    prediction.status &&
    ["starting", "processing"].includes(prediction.status) &&
    pollUrl &&
    attempts < 40
  ) {
    await wait(1500);
    const polled = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    prediction = (await polled.json()) as ReplicatePrediction;
    attempts += 1;
  }
  if (prediction.status === "failed" || prediction.status === "canceled") {
    throw new Error(replicateError(prediction) || `Replicate ${prediction.status}`);
  }
  const content = joinReplicateOutput(prediction.output);
  if (!content) {
    throw new Error("Replicate returned empty output from google/gemini-3.5-flash");
  }
  return content;
}

function joinReplicateOutput(output: unknown): string {
  if (typeof output === "string") {
    return output;
  }
  if (Array.isArray(output)) {
    return output
      .filter((part): part is string => typeof part === "string")
      .join("");
  }
  if (output && typeof output === "object" && "text" in output) {
    const text = (output as { text?: unknown }).text;
    return typeof text === "string" ? text : "";
  }
  return "";
}

function replicateError(prediction: ReplicatePrediction): string {
  if (typeof prediction.error === "string") {
    return prediction.error;
  }
  return prediction.error?.message ?? "";
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseModelJson(content: string): Record<string, unknown> {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? trimmed;
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Model did not return a JSON object");
  }
  return parsed as Record<string, unknown>;
}
