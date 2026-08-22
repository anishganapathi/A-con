export const DEFAULT_LOCAL_LLM_URL = "http://10.0.1.20:8080/v1";
export const DEFAULT_LOCAL_LLM_MODEL = "Qwen3VL-30B-A3B-Instruct-Q4_K_M.gguf";

export interface LocalLlmStatus {
  up: boolean;
  url: string;
  models: string[];
}

export interface VisionAttachment {
  name?: string;
  type?: string;
  dataUrl?: string;
}

export interface VisionRequest {
  text?: string;
  role?: string;
  plan?: string;
  locked?: boolean;
  attachments?: VisionAttachment[];
}

/** llama.cpp / OpenAI-compat base, always ending in /v1. */
export function localLlmBaseUrl(env: Record<string, string> = {}): string {
  const raw = env.ECON_LOCAL_LLM_URL?.trim() || DEFAULT_LOCAL_LLM_URL;
  const trimmed = raw.replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

export function localLlmModel(env: Record<string, string> = {}, requested?: string): string {
  return requested || env.ECON_LOCAL_LLM_MODEL || env.ECON_AGENT_MODEL || DEFAULT_LOCAL_LLM_MODEL;
}

export async function probeLocalLlm(
  env: Record<string, string> = {},
): Promise<LocalLlmStatus> {
  const url = localLlmBaseUrl(env);
  try {
    const response = await fetch(`${url}/models`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) {
      return { up: false, url, models: [] };
    }
    const data = (await response.json()) as { data?: { id?: string }[] };
    return {
      up: true,
      url,
      models: (data.data ?? []).map((model) => model.id ?? "").filter(Boolean),
    };
  } catch {
    return { up: false, url, models: [] };
  }
}

export function imageDataUrls(attachments: VisionAttachment[] | undefined): string[] {
  return (attachments ?? [])
    .map((file) => file.dataUrl)
    .filter((value): value is string => Boolean(value?.startsWith("data:image/")));
}

export function buildVisionUserContent(request: VisionRequest): unknown {
  const images = imageDataUrls(request.attachments);
  const text = [
    request.text?.trim() || "Read the attached drawing and follow that prompt.",
    request.plan
      ? `\nLive FloorPlan (do NOT copy its storeys, rooms, or roof if the user asked to rebuild from a drawing — that is the old model):\n${request.plan}`
      : "",
  ].join("");
  if (images.length === 0) {
    return text;
  }
  return [
    { type: "text", text },
    ...images.map((url) => ({ type: "image_url", image_url: { url } })),
  ];
}

const EDIT_ACTION_TYPES = new Set([
  "patch_roof",
  "resize_room",
  "patch_wall",
  "patch_room",
  "patch_opening",
  "patch_pipe",
  "patch_electrical",
  "set_material",
  // Adding a socket or a pipe is an edit, not a rebuild. Without these the
  // action is stripped and the turn silently changes nothing.
  "add_wall",
  "add_room",
  "add_opening",
  "add_pipe",
  "add_electrical",
  "remove",
]);

/** Drop rebuilds so a vision turn cannot replace the live model. */
export function editActionsOnly(actions: unknown): Record<string, unknown>[] {
  const list = Array.isArray(actions)
    ? actions
    : actions && typeof actions === "object"
      ? [actions]
      : [];
  return list.filter((action): action is Record<string, unknown> => {
    return Boolean(
      action &&
        typeof action === "object" &&
        EDIT_ACTION_TYPES.has(String((action as { type?: string }).type)),
    );
  });
}
