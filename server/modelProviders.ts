import {
  buildVisionUserContent,
  explainLocalFetchError,
  localLlmBaseUrl,
  localLlmModel,
  type VisionRequest,
} from "./localLlm.ts";
import {
  applyMasterCall,
  MASTER_PROMPT,
  MASTER_TOOLS,
  messageText,
  parseMasterCall,
} from "./masterIntent.ts";

export type ServerProvider =
  | "replicate"
  | "gemini"
  | "groq"
  | "openai"
  | "openrouter"
  | "gateway"
  | "ollama"
  | "local";

const REPLICATE_MODEL = "google/gemini-3.5-flash";

export interface ProviderConfig {
  provider: ServerProvider;
  model: string;
  apiKey: string;
  /** OpenAI-compat base ending in /v1, used by the on-LAN vision box. */
  baseUrl?: string;
}

export const SYSTEM_PROMPT = `You are E-kon's construction orchestrator using Gemini 3.5 Flash on Replicate.
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
- Tower / high-rise / landmark = slim plate, many stories, setbacks via massing.

SHAPE IS YOURS TO CHOOSE. width and depth only ever make a plain rectangle, so
use them for genuinely rectangular buildings. For anything else give a
"footprint" and the plate is built from that outline instead:
- footprint is an array of {x, y} points in meters, counter-clockwise, with the
  origin at the outline's bottom-left. 4 to 24 points. Do NOT repeat the first
  point at the end. Minimum 12 m² and no dimension over 400 m.
- Reach for it whenever the plan is non-rectangular: L-shaped wings, a U around
  a courtyard, a T or cross, a chamfered or angled corner, a curved frontage
  (approximate the curve with 10–20 points), a tapered or trapezoidal site.
- An L-shaped office might be:
  [{"x":0,"y":0},{"x":40,"y":0},{"x":40,"y":14},{"x":18,"y":14},{"x":18,"y":30},{"x":0,"y":30}]

For a building whose silhouette changes with height, add "massing": bands of
extruded volume, bottom-up, each {minHeight, maxHeight, polygon} in the same
coordinates as the footprint. Bands should touch (one band's maxHeight is the
next band's minHeight) so the stack has no gaps, and upper polygons should sit
inside lower ones so the setbacks read. Up to 16 bands. This is how you build a
stepped tower rather than a straight extrusion.

If the structure carries a spire, mast, or antenna above the roof, set
"tipHeight" to the height of the tip in meters and it is drawn as a tapering
mast. Leave it out for a flat-topped building.

spec.zones are axis-aligned rectangles in meters from the origin. They must
cover the plate without large empty holes. Each zone: id, name, x, y, w, h,
kind (entry|sales|service|back|wet|circulation|living|work). Omit zones on a
tower and a service core with a perimeter ring is laid out for you.

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
    "footprint": [{ "x": 0, "y": 0 }],
    "massing": [
      { "minHeight": 0, "maxHeight": 24, "polygon": [{ "x": 0, "y": 0 }] }
    ],
    "tipHeight": 0,
    "zones": [
      { "id": "vestibule", "name": "Vestibule", "x": 28, "y": 0, "w": 16, "h": 8, "kind": "entry" }
    ]
  },
  "actions": []
}

Emit footprint, massing and tipHeight only when they add shape the rectangle
cannot. For edits only, omit spec and use actions against existing IDs from the
plan summary. To take the roof off the live model, emit
{"type":"patch_roof","patch":{"visible":false}} — do not replace the plan.
Units are meters.`;

export function envFlags(
  env: Record<string, string>,
): Record<ServerProvider, boolean> {
  return {
    replicate: Boolean(env.REPLICATE_API_TOKEN || env.REPLICATE_API_KEY),
    gemini: Boolean(env.REPLICATE_API_TOKEN || env.REPLICATE_API_KEY),
    groq: Boolean(env.GROQ_API_KEY),
    openai: Boolean(env.OPENAI_API_KEY),
    openrouter: Boolean(env.OPENROUTER_API_KEY),
    gateway: Boolean(env.AI_GATEWAY_API_KEY),
    ollama: false,
    local: Boolean(env.ECON_LOCAL_LLM_URL || env.ECON_AGENT_PROVIDER === "local"),
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
  const apiKey = requested?.apiKey || envKey(env, provider);
  // The local VL box and Ollama are both unauthenticated.
  const selfAuthenticating = provider === "ollama" || provider === "local";
  if (!selfAuthenticating && !apiKey) {
    return null;
  }
  const model =
    provider === "local"
      ? localLlmModel(env, requested?.model)
      : requested?.model || env.ECON_AGENT_MODEL || defaultModel(provider);
  return {
    provider,
    apiKey,
    baseUrl: provider === "local" ? localLlmBaseUrl(env) : requested?.baseUrl,
    // Normalized here so the model reported back to the client is the one that
    // actually ran.
    model:
      provider === "replicate" || provider === "gemini" ? replicateModelPath(model) : model,
  };
}

/**
 * Ollama only serves models that have actually been pulled, so asking for one
 * it does not have fails the whole turn. Tags are optional in a request
 * ("llama3.2") but always present in the install list ("llama3.2:latest").
 */
export function pickOllamaModel(
  requested: string | undefined,
  configured: string | undefined,
  installed: string[],
): string {
  for (const candidate of [requested, configured]) {
    if (!candidate) {
      continue;
    }
    const match = installed.find(
      (name) => name === candidate || name.split(":")[0] === candidate.split(":")[0],
    );
    if (match) {
      return match;
    }
  }
  return installed[0] ?? defaultModel("ollama");
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
  if (config.provider === "local") {
    const parsed = await completeLocalMaster(config, userPayload as VisionRequest);
    return { parsed, model: config.model, provider: config.provider };
  }
  const user = JSON.stringify(userPayload);
  const content =
    config.provider === "replicate" || config.provider === "gemini"
      ? await completeReplicateGemini(config, user)
      : await completeOpenAiCompat(config, user);
  return { parsed: parseModelJson(content), model: config.model, provider: config.provider };
}

/** The on-LAN VL box is the planner; the hosted models are only a fallback. */
function firstAvailable(env: Record<string, string>): ServerProvider | undefined {
  const flags = envFlags(env);
  const order: ServerProvider[] = [
    "local",
    "replicate",
    "gemini",
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
  if (provider === "local") {
    return localLlmModel({});
  }
  return "llama3.2";
}

function endpoint(config: ProviderConfig): string {
  if (config.provider === "groq") {
    return "https://api.groq.com/openai/v1/chat/completions";
  }
  if (config.provider === "openai") {
    return "https://api.openai.com/v1/chat/completions";
  }
  if (config.provider === "openrouter") {
    return "https://openrouter.ai/api/v1/chat/completions";
  }
  if (config.provider === "gateway") {
    return "https://ai-gateway.vercel.sh/v1/chat/completions";
  }
  if (config.provider === "local") {
    return `${config.baseUrl ?? localLlmBaseUrl({})}/chat/completions`;
  }
  return "http://127.0.0.1:11434/v1/chat/completions";
}

async function completeLocalMaster(
  config: ProviderConfig,
  request: VisionRequest,
): Promise<Record<string, unknown>> {
  const messages = [
    { role: "system", content: MASTER_PROMPT },
    { role: "user", content: buildVisionUserContent(request) },
  ];
  const withTools = await postLocalChat(config, {
    messages,
    tools: MASTER_TOOLS,
  });
  const first = withTools.ok ? withTools.payload.choices?.[0]?.message : undefined;
  const payload =
    first && (first.tool_calls || messageText(first.content).trim())
      ? withTools.payload
      : (await postLocalChat(config, { messages })).payload;
  const message = payload.choices?.[0]?.message;
  if (!message) {
    throw new Error(
      payload.error?.message ?? withTools.error ?? "Local VL returned an empty completion",
    );
  }
  const call = parseMasterCall(messageText(message.content), {
    tool_calls: message.tool_calls,
  });
  return applyMasterCall(call, request);
}

async function postLocalChat(
  config: ProviderConfig,
  body: { messages: unknown[]; tools?: unknown },
): Promise<{
  ok: boolean;
  error?: string;
  payload: {
    error?: { message?: string };
    choices?: { message?: { content?: unknown; tool_calls?: unknown } }[];
  };
}> {
  let response: Response;
  try {
    response = await fetch(endpoint(config), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        // Greedy: reading a sheet has one right answer, and sampling makes the
        // same drawing come back as a different house each time.
        temperature: 0,
        max_tokens: 4096,
        ...body,
      }),
    });
  } catch (error) {
    throw explainLocalFetchError(error, config.baseUrl ?? localLlmBaseUrl({}));
  }
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: { message?: { content?: unknown; tool_calls?: unknown } }[];
  };
  return {
    ok: response.ok,
    error: payload.error?.message ?? (response.ok ? undefined : `Local VL returned ${response.status}`),
    payload,
  };
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
  const response = await fetch(endpoint(config), {
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

interface ReplicatePrediction {
  id?: string;
  status?: string;
  error?: string | { message?: string };
  output?: unknown;
  urls?: { get?: string };
}

/**
 * Replicate's predictions endpoint is keyed by an `owner/model` path. Anything
 * else — a bare name, or a `model:version` ref — would 404, so it falls back to
 * the Gemini default rather than failing the turn.
 */
export function replicateModelPath(model: string | undefined): string {
  return model && /^[^/\s]+\/[^/\s]+$/.test(model) ? model : REPLICATE_MODEL;
}

async function completeReplicateGemini(
  config: ProviderConfig,
  user: string,
): Promise<string> {
  const model = replicateModelPath(config.model);
  const created = await fetch(
    `https://api.replicate.com/v1/models/${model}/predictions`,
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
  if (prediction.status === "starting" || prediction.status === "processing") {
    throw new Error(`${model} was still running after 60s on Replicate`);
  }
  const content = joinReplicateOutput(prediction.output);
  if (!content) {
    throw new Error(`Replicate returned empty output from ${model}`);
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
  const trimmed = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? trimmed;
  const object = raw.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(object?.[0] ?? raw) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Model did not return a JSON object");
  }
  return parsed as Record<string, unknown>;
}
