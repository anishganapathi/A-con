import type { FloorPlan } from "../types/floorPlan";
import {
  addElectricalInPlan,
  addOpeningInPlan,
  addPipeInPlan,
  addRoomInPlan,
  addWallInPlan,
  findNamed,
  patchElectricalInPlan,
  patchOpeningInPlan,
  patchPipeInPlan,
  patchRoomInPlan,
  patchWallInPlan,
  removeSelectionInPlan,
  resizeRoomInPlan,
} from "../editor/floorPlanEdits";
import type { AgentAction } from "./types";

export function applyAgentAction(plan: FloorPlan, action: AgentAction): FloorPlan {
  switch (action.type) {
    case "replace_plan":
      return action.plan;
    case "patch_roof":
      return { ...plan, roof: { ...plan.roof, ...(action.patch ?? {}) } };
    case "resize_room":
      return resizeRoomInPlan(plan, action.roomId, action.areaSqM, {
        stack: action.stack,
      });
    case "patch_wall":
      return patchWallInPlan(plan, action.wallId, action.patch);
    case "patch_room":
      return patchRoomInPlan(plan, action.roomId, action.patch);
    case "patch_opening":
      return patchOpeningInPlan(plan, action.openingId, action.patch);
    case "patch_pipe":
      return patchPipeInPlan(plan, action.pipeId, action.patch);
    case "patch_electrical":
      return patchElectricalInPlan(plan, action.runId, action.patch);
    case "add_wall":
      return addWallInPlan(plan, action.floorId, action.wall);
    case "add_room":
      return addRoomInPlan(plan, action.floorId, action.room);
    case "add_opening":
      return addOpeningInPlan(plan, action.floorId, action.opening);
    case "add_pipe":
      return addPipeInPlan(plan, action.floorId, action.pipe);
    case "add_electrical":
      return addElectricalInPlan(plan, action.floorId, action.run);
    case "remove":
      return removeSelectionInPlan(plan, action.selection);
    case "set_material": {
      const found = findNamed(plan, action.match);
      if (!found) {
        return plan;
      }
      if (found.selection.kind === "wall") {
        return patchWallInPlan(plan, found.selection.id, {
          material: action.material,
        });
      }
      if (found.selection.kind === "room") {
        return patchRoomInPlan(plan, found.selection.id, {
          material: action.material,
        });
      }
      if (found.selection.kind === "pipe") {
        return patchPipeInPlan(plan, found.selection.id, {
          material: action.material,
        });
      }
      if (found.selection.kind === "electrical") {
        return patchElectricalInPlan(plan, found.selection.id, {
          material: action.material,
        });
      }
      return plan;
    }
    default:
      return plan;
  }
}

export function describeAction(action: AgentAction): string {
  switch (action.type) {
    case "replace_plan":
      return action.note;
    case "patch_roof":
      return action.patch?.visible === false
        ? "Removed the roof"
        : action.patch?.ridgeHeight !== undefined || action.patch?.eaveHeight !== undefined
          ? "Steepened the roof"
          : "Updated the roof";
    case "resize_room":
      return action.stack === false
        ? `Resized room ${action.roomId} to ${action.areaSqM} m² on that floor only`
        : `Resized room ${action.roomId} to ${action.areaSqM} m² and stacked the supporting floors`;
    case "patch_wall":
      return `Updated wall ${action.wallId}`;
    case "patch_room":
      return `Updated room ${action.roomId}`;
    case "patch_opening":
      return `Updated opening ${action.openingId}${describeOpeningPatch(action.patch)}`;
    case "patch_pipe":
      return `Updated pipe ${action.pipeId}`;
    case "patch_electrical":
      return `Updated electrical ${action.runId}`;
    case "add_wall":
      return `Added wall ${action.wall.id}`;
    case "add_room":
      return `Added room ${action.room.name}`;
    case "add_opening":
      return `Added ${action.opening.type} ${action.opening.id}`;
    case "add_pipe":
      return `Added pipe ${action.pipe.name}`;
    case "add_electrical":
      return `Added ${action.run.name}`;
    case "remove":
      return `Removed ${action.label ?? `${action.selection.kind} ${action.selection.id}`}`;
    case "set_material":
      return `Set material on ${action.match}`;
    default:
      return "Updated plan";
  }
}

const OPENING_LABELS: Record<string, string> = {
  offsetFromStart: "along the wall",
  width: "wide",
  height: "tall",
  sillHeight: "sill",
};

function describeOpeningPatch(patch: Record<string, unknown> | undefined): string {
  const parts = Object.entries(patch ?? {})
    .filter(([key, value]) => key in OPENING_LABELS && typeof value === "number")
    .map(([key, value]) => `${value} m ${OPENING_LABELS[key]}`);
  return parts.length > 0 ? ` — ${parts.join(", ")}` : "";
}
