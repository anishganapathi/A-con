import type { FloorPlan } from "../types/floorPlan";
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
  actions?: AgentTurn["actions"];
}

export async function planLlmActions(input: {
  text: string;
  plan: FloorPlan;
  role: AgentRole;
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
    if (!data.reply && !data.spec && !data.brief && !data.actions) {
      return null;
    }
    const actions = [...(data.actions ?? [])];
    // A proposed building is returned as a draft rather than compiled here, so
    // the size and glazing can be chosen before anything replaces the plan.
    const proposal =
      (data.agent === "construct" || data.agent === "extract" || input.role === "construct") &&
      (data.spec || data.brief)
        ? normalizeSpec(data.spec ?? briefToSpec(data.brief))
        : undefined;

    return {
      agent: data.agent ?? input.role,
      planner: "llm",
      model: data.provider ? `${data.provider}/${data.model}` : data.model,
      reply: data.reply ?? "Updated the construction from the model.",
      actions,
      draftSpec: proposal,
    };
  } catch (error) {
    throw error;
  }
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
