import type { FloorPlan } from "../types/floorPlan";
import { applyAgentAction, describeAction } from "./applyAction";
import { inferSpecFromPrompt } from "./buildingSpec";
import { compileSpec } from "./compileSpec";
import { planEdits } from "./editAgent";
import { narrateEdit } from "./followUp";
import { actionsFromIntent, interpretIntent } from "./intentAgent";
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
  /** When set, the model on screen may be edited but never rebuilt. */
  locked?: boolean;
}): Promise<AgentTurn> {
  const role = resolveAgentRole(
    input.text,
    input.attachments,
    input.locked,
    input.plan,
  );
  const guard = (turn: AgentTurn) => (input.locked ? lockWorkspaceTurn(turn) : turn);

  // A named NYC building is a survey, not a guess — resolve it from GIS and
  // skip the model entirely so the envelope stays measured.
  if (role === "construct" && looksLikeNycLookup(input.text)) {
    return guard(await runGisBuild(input.text));
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
      return guard(llm);
    }
  } catch (error) {
    if (input.requireApi) {
      throw error;
    }
  }
  return guard(runLocal(role, input.text, input.plan, input.attachments ?? []));
}

/**
 * What the prompt is asking for. A locked workspace can still be edited, so a
 * prompt that would author a new building is answered against the live model
 * instead of replacing it.
 */
export function resolveAgentRole(
  text: string,
  attachments?: ChatAttachment[],
  locked = false,
  plan?: FloorPlan,
): AgentRole {
  const role = interpretIntent(text, plan, attachments).role;
  if (locked && (role === "construct" || role === "extract")) {
    return "edit";
  }
  return role;
}

/**
 * Last line of defence for a locked workspace: the planner can still come back
 * with a whole new plan, and this drops anything that would overwrite the model
 * while keeping the edits that only touch it.
 */
export function lockWorkspaceTurn(turn: AgentTurn): AgentTurn {
  const actions = turn.actions.filter((action) => action.type !== "replace_plan");
  const rebuilding = actions.length !== turn.actions.length || turn.draftSpec !== undefined;
  if (!rebuilding) {
    return turn;
  }
  return {
    ...turn,
    agent: "edit",
    draftSpec: undefined,
    actions,
    reply: `${turn.reply}\n\nThe workspace is locked, so I kept the model that is on screen and applied only the live edits. Unlock it to build something new.`,
  };
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
    const intent = interpretIntent(text, plan);
    const actions =
      intent.kind === "freeform" ? planEdits(text, plan) : actionsFromIntent(intent);
    if (actions.length === 0 && intent.kind === "freeform") {
      return {
        agent,
        planner: "local",
        reply: "I couldn’t map that edit. Try “remove the roof”, “paint exterior walls warmer”, “add a waste pipe to the kitchen”, “thicken exterior walls to 0.4”, or “rename Bathroom to Powder Room”.",
        actions: [],
      };
    }
    const after = actions.reduce(applyAgentAction, plan);
    const story =
      intent.kind === "freeform"
        ? {
            reply: `Edit agent applied ${actions.length} change${actions.length === 1 ? "" : "s"} to the live FloorPlan.`,
          }
        : narrateEdit(intent, plan, after);
    return {
      agent,
      planner: intent.kind === "freeform" ? "local" : "intent",
      reply: story.reply,
      actions,
      followUp: story.followUp,
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
      "Examples: “Build a 12×8 two-story house with 2 bedrooms”, “Increase the L3 living room size to 38 m”, “Add a supply pipe to the kitchen”, “Extract these sheets”.",
    ].join("\n"),
    actions: [],
  };
}

export function actionLabels(turn: AgentTurn): string[] {
  return turn.actions.map(describeAction);
}
