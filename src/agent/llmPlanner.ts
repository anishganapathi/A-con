import type { FloorPlan } from "../types/floorPlan";
import { bindVisionEdits } from "./bindVisionEdits";
import {
  applyElevationMatch,
  elevationMatchReply,
  facadeChanged,
  type ElevationBrief,
} from "./matchElevation";
import { normalizeSpec, type BuildingSpec } from "./buildingSpec";
import type { ModelSettings } from "./modelSettings";
import { summarizePlan } from "./summarize";
import type { AgentRole, AgentTurn, BuildBrief, ChatAttachment } from "./types";

interface LlmResponse {
  agent?: AgentRole;
  reply?: string;
  model?: string;
  provider?: string;
  spec?: Partial<BuildingSpec>;
  brief?: Partial<BuildBrief>;
  elevation?: ElevationBrief;
  actions?: AgentTurn["actions"];
}

export async function planLlmActions(input: {
  text: string;
  plan: FloorPlan;
  role: AgentRole;
  locked?: boolean;
  attachments?: ChatAttachment[];
  settings?: ModelSettings;
}): Promise<AgentTurn | null> {
  try {
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: input.text,
        role: input.role,
        locked: input.locked,
        plan: summarizePlan(input.plan),
        attachments: input.attachments ?? [],
        provider: input.settings?.provider,
        apiKey: input.settings?.apiKey,
        model: input.settings?.model,
      }),
    });
    if (response.status === 204 || response.status === 404) {
      return null;
    }
    if (!response.ok) {
      const failure = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(failure?.error ?? `Agent API ${response.status}`);
    }
    const data = (await response.json()) as LlmResponse;
    if (!data.reply && !data.spec && !data.brief && !data.actions && !data.elevation) {
      return null;
    }
    const raw = asActionList(data.actions).filter((action) => action.type !== "replace_plan");
    let actions =
      data.agent === "edit" || data.agent === undefined
        ? bindVisionEdits(input.plan, raw, input.text)
        : raw;
    let reply = cleanChatReply(data.reply) ?? "The master intent finished that turn.";
    const hasDrawing = Boolean(
      input.attachments?.some(
        (file) => file.dataUrl?.startsWith("data:image/") || file.type.startsWith("image/"),
      ),
    );
    if (
      (data.agent === "edit" || data.agent === undefined) &&
      !actions.some((action) => action.type === "resize_room") &&
      (data.elevation || (hasDrawing && !facadeChanged(input.plan, actions)))
    ) {
      const matched = applyElevationMatch(input.plan, data.elevation ?? {});
      if (matched.length > 0) {
        actions = matched;
        reply = elevationMatchReply(data.reply ?? "", matched);
      }
    }
    // A confident reply with nothing bound behind it reads as a silent failure.
    if (raw.length > 0 && actions.length === 0 && !data.spec && !data.brief) {
      reply = `${reply}\n\nNothing on the model changed — that edit either matched what is already there or did not resolve to anything I can move. Name the item by id and give the target value in metres.`;
    }
    const proposal =
      (data.agent === "construct" || data.agent === "extract") && (data.spec || data.brief)
        ? normalizeSpec(data.spec ?? briefToSpec(data.brief))
        : undefined;

    return {
      agent: data.agent ?? "edit",
      planner: "llm",
      model: data.provider ? `${data.provider}/${data.model}` : data.model,
      reply,
      actions,
      draftSpec: proposal,
    };
  } catch (error) {
    throw error;
  }
}

function cleanChatReply(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (!trimmed.startsWith("{")) {
    return trimmed;
  }
  try {
    const parsed = JSON.parse(trimmed) as { reply?: unknown; arguments?: { reply?: unknown } };
    const direct = typeof parsed.reply === "string" ? parsed.reply : undefined;
    // A call the model wrote out as text keeps its sentence one level down.
    const nested =
      typeof parsed.arguments?.reply === "string" ? parsed.arguments.reply : undefined;
    const sentence = direct ?? nested;
    if (sentence && !sentence.trim().startsWith("{")) {
      return sentence.trim();
    }
  } catch {
    /* fall through to the loose match below */
  }
  const match = trimmed.match(/"reply"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (match?.[1]) {
    return match[1].replace(/\\n/g, " ").replace(/\\"/g, '"');
  }
  // Announcing a rebuild here was a guess, and a wrong one on every turn that
  // was not a build. Better to say nothing than to narrate the wrong thing.
  return undefined;
}

function asActionList(value: unknown): AgentTurn["actions"] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    try {
      return asActionList(JSON.parse(value));
    } catch {
      return [];
    }
  }
  if (value && typeof value === "object" && "type" in value) {
    return [value as AgentTurn["actions"][number]];
  }
  return [];
}

function briefToSpec(brief: Partial<BuildBrief> | undefined): Partial<BuildingSpec> {
  return {
    name: brief?.name,
    width: brief?.width,
    depth: brief?.depth,
    stories: brief?.stories,
    storyHeight: brief?.storyHeight,
    includeMep: brief?.includeMep,
    notes: brief?.notes,
    project: brief?.project,
  };
}
