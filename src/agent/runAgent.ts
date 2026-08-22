import type { FloorPlan } from "../types/floorPlan";
import { describeAction } from "./applyAction";
import { inferSpecFromPrompt } from "./buildingSpec";
import { compileSpec } from "./compileSpec";
import { planEdits } from "./editAgent";
import {
  describeGis,
  fetchNycBuilding,
  looksLikeNycLookup,
  specFromGis,
} from "./gisBuilding";
import { planLlmActions } from "./llmPlanner";
import type { ModelSettings } from "./modelSettings";
import { summarizePlan } from "./summarize";
import type { AgentRole, AgentTurn, ChatAttachment } from "./types";

export async function runConstructionAgent(input: {
  text: string;
  plan: FloorPlan;
  attachments?: ChatAttachment[];
  settings?: ModelSettings;
  requireApi?: boolean;
}): Promise<AgentTurn> {
  const role = route(input.text, input.attachments);

  // A named NYC building is a survey, not a guess — resolve it from GIS and
  // skip the model entirely so the envelope stays measured.
  if (role === "construct" && looksLikeNycLookup(input.text)) {
    return runGisBuild(input.text);
  }

  try {
    const llm = await planLlmActions({
      text: input.text,
      plan: input.plan,
      role,
      attachments: input.attachments,
      settings: input.settings,
    });
    if (llm) {
      return llm;
    }
  } catch (error) {
    if (input.requireApi) {
      throw error;
    }
  }
  return runLocal(role, input.text, input.plan, input.attachments ?? []);
}

async function runGisBuild(text: string): Promise<AgentTurn> {
  try {
    const building = await fetchNycBuilding(text);
    const spec = specFromGis(building);
    const next = compileSpec(spec);
    return {
      agent: "construct",
      planner: "gis",
      model: "nyc-open-data",
      reply: describeGis(building),
      actions: [
        {
          type: "replace_plan",
          plan: next,
          note: `Surveyed ${building.name} · BBL ${building.bbl}`,
        },
      ],
    };
  } catch (error) {
    return {
      agent: "explain",
      planner: "gis",
      reply: `NYC GIS lookup failed: ${error instanceof Error ? error.message : "unknown error"}\n\nTry a full street address with the borough, for example “350 5th Ave, Manhattan”, or a 10-digit BBL.`,
      actions: [],
    };
  }
}

function route(text: string, attachments?: ChatAttachment[]): AgentRole {
  const lower = text.toLowerCase();
  if (
    (attachments && attachments.length > 0) ||
    /extract|from (?:the )?(?:drawing|sheet|pdf|scan|sketch)|upload/.test(lower)
  ) {
    return "extract";
  }
  if (
    /build|construct|create|make|generate|new |commercial|retail|warehouse|store|supercenter|walmart|costco|target|office|apartment|house/.test(
      lower,
    )
  ) {
    return "construct";
  }
  if (
    /add|move|delete|remove|rename|paint|color|thicken|set |raise|lower/.test(
      lower,
    )
  ) {
    return "edit";
  }
  return "explain";
}

function runLocal(
  agent: AgentRole,
  text: string,
  plan: FloorPlan,
  attachments: ChatAttachment[],
): AgentTurn {
  if (agent === "construct") {
    const spec = inferSpecFromPrompt(text);
    return {
      agent,
      planner: "local",
      reply: `Drafted a ${spec.typology} from local rules. Choose the size and glazing and I'll build it.`,
      actions: [],
      draftSpec: spec,
    };
  }

  if (agent === "extract") {
    const spec = inferSpecFromPrompt(text);
    spec.notes = `Draft extraction from ${attachments.length || "chat"} sheet${attachments.length === 1 ? "" : "s"} (${attachments.map((file) => file.name).join(", ") || "no files"}).`;
    spec.project = attachments[0]?.name.replace(/\.[^.]+$/, "") ?? spec.name;
    spec.name = spec.project ?? spec.name;
    const next = compileSpec(spec);
    next.source.sheet = "X1.0";
    next.source.title = "Extracted composite · pending review";
    return {
      agent,
      planner: "local",
      reply: `Ingested ${attachments.length} drawing${attachments.length === 1 ? "" : "s"} and drafted a ${spec.width} × ${spec.depth} m ${spec.typology} model.`,
      actions: [
        {
          type: "replace_plan",
          plan: next,
          note: `Extracted draft from ${attachments.length} document(s)`,
        },
      ],
    };
  }

  if (agent === "edit") {
    const actions = planEdits(text, plan);
    if (actions.length === 0) {
      return {
        agent,
        planner: "local",
        reply: "I couldn’t map that edit. Try “paint exterior walls warmer”, “add a waste pipe to the kitchen”, “thicken exterior walls to 0.4”, or “rename Bathroom to Powder Room”.",
        actions: [],
      };
    }
    return {
      agent,
      planner: "local",
      reply: `Edit agent applied ${actions.length} change${actions.length === 1 ? "" : "s"} to the live FloorPlan.`,
      actions,
    };
  }

  return {
    agent: "explain",
    planner: "local",
    reply: [
      "I can construct a building, edit the live model, or draft from drawings.",
      "",
      summarizePlan(plan),
      "",
      "Examples: “Build a 12×8 two-story house with 2 bedrooms”, “Add a supply pipe to the kitchen”, “Extract these sheets”.",
    ].join("\n"),
    actions: [],
  };
}

export function actionLabels(turn: AgentTurn): string[] {
  return turn.actions.map(describeAction);
}
