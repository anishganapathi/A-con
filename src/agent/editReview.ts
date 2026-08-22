import { previewRoomResize, type RoomResizePreview } from "../editor/floorPlanEdits";
import type { Floor, FloorPlan, Point2D } from "../types/floorPlan";
import { applyAgentAction } from "./applyAction";
import type { AgentAction } from "./types";

export interface EditNotice {
  severity: "grows-footprint" | "overhangs" | "irrelevant";
  title: string;
  detail: string;
  /**
   * Label for the middle answer, when the change is phrased as an area and can
   * be brought back to what fits. Absent when there is nothing to clamp.
   */
  fitLabel?: string;
  /** The turn exactly as the agent asked for it. */
  asked: AgentAction[];
  /** The same turn with every oversized room brought back to what fits. */
  trimmed: AgentAction[];
}

/** Faces closer than this are the same face; matches the resize's own snapping. */
const FACE_EPS = 0.06;

/**
 * A background check between the agent and the model. An edit that cannot be
 * absorbed by the plate does not fail — it deforms the building, either by
 * dragging every storey's facade out or by moving one storey's wall past the
 * others. Both are worth a question rather than a surprise.
 */
export function reviewEdits(plan: FloorPlan, actions: AgentAction[]): EditNotice | null {
  if (actions.length === 0) {
    return null;
  }
  // A replacement is a different building, not a deformation of this one.
  if (actions.some((action) => action.type === "replace_plan")) {
    return null;
  }
  return reviewResizes(plan, actions) ?? reviewScale(plan, actions) ?? reviewShell(plan, actions);
}

/** A single storey taller than this has left the building and become a tower. */
const MAX_STOREY_M = 12;
/** Ridge on a mid-rise. A house asking for 80 m+ is not a roof revision. */
const MAX_RIDGE_M = 80;
const MAX_ROOM_SIDE_M = 80;
const MAX_OPENING_M = 15;

/**
 * The precise case: an area was named, so the reply can say what the plate holds
 * and offer that size instead.
 */
function reviewResizes(plan: FloorPlan, actions: AgentAction[]): EditNotice | null {
  const flagged: RoomResizePreview[] = [];
  const trimmed = [...actions];
  // Each action is measured against the plan the ones before it leave behind,
  // otherwise two resizes in a turn are both judged against a plate that only
  // the first one ever saw.
  let running = plan;
  actions.forEach((action, index) => {
    if (action.type !== "resize_room") {
      running = applyAgentAction(running, action);
      return;
    }
    const preview = previewRoomResize(running, action.roomId, action.areaSqM, {
      stack: action.stack,
    });
    if (preview.outcome === "grows-footprint" || preview.outcome === "overhangs") {
      flagged.push(preview);
      trimmed[index] = { ...action, areaSqM: preview.maxAreaSqM };
    }
    running = applyAgentAction(running, action);
  });

  const preview = flagged[0];
  if (!preview) {
    return null;
  }
  const others = flagged.length - 1;
  return {
    severity: preview.outcome === "grows-footprint" ? "grows-footprint" : "overhangs",
    title: `${preview.roomName} at ${trim(preview.requestedSqM)} m² ${
      preview.outcome === "grows-footprint" ? "grows the building" : "overflows the building"
    }`,
    detail:
      describeResize(preview) +
      (others > 0
        ? ` Holding ${others} other change${others === 1 ? "" : "s"} with the same problem.`
        : ""),
    fitLabel:
      preview.maxAreaSqM >= preview.currentSqM
        ? `Keep ${trim(preview.currentSqM)} m²`
        : `Use ${trim(preview.maxAreaSqM)} m²`,
    asked: actions,
    trimmed,
  };
}

/**
 * Nemoclaw's second watch: a number that cannot be a building. "L3 to 900 m"
 * is not a storey revision — it is an irrelevant measurement, and it must not
 * reach the model until someone accepts it on the card.
 */
function reviewScale(plan: FloorPlan, actions: AgentAction[]): EditNotice | null {
  const after = actions.reduce(applyAgentAction, plan);
  const storey = tallestStorey(plan, after);
  if (storey) {
    return {
      severity: "irrelevant",
      title: `${storey.name} at ${trim(storey.next)} m is not a storey`,
      detail: `A floor plate is a few metres high. ${storey.name}'s walls would go from ${trim(
        storey.prev,
      )} m to ${trim(storey.next)} m. That is out of scale for this building, so Nemoclaw held the edit.`,
      asked: actions,
      trimmed: [],
    };
  }

  if (after.roof.ridgeHeight > MAX_RIDGE_M && after.roof.ridgeHeight - plan.roof.ridgeHeight > 1) {
    return {
      severity: "irrelevant",
      title: `Ridge at ${trim(after.roof.ridgeHeight)} m is not a roof`,
      detail: `The live ridge is ${trim(plan.roof.ridgeHeight)} m. ${trim(
        after.roof.ridgeHeight,
      )} m is a tower, not a revision of this gable.`,
      asked: actions,
      trimmed: [],
    };
  }

  const room = oversizedRoom(after);
  if (room) {
    return {
      severity: "irrelevant",
      title: `${room.name} at ${trim(room.span)} m is out of scale`,
      detail: `${room.name} would be ${trim(room.span)} m across. That is not a room on this plate.`,
      asked: actions,
      trimmed: [],
    };
  }

  const opening = oversizedOpening(after);
  if (opening) {
    return {
      severity: "irrelevant",
      title: `An opening at ${trim(opening.size)} m is out of scale`,
      detail: `${opening.name} would be ${trim(opening.size)} m. Nemoclaw held the edit.`,
      asked: actions,
      trimmed: [],
    };
  }

  return null;
}

function tallestStorey(
  before: FloorPlan,
  after: FloorPlan,
): { name: string; prev: number; next: number } | null {
  let worst: { name: string; prev: number; next: number } | null = null;
  for (const floor of after.floors) {
    const prior = before.floors.find((entry) => entry.id === floor.id);
    const next = maxWallHeight(floor);
    const prev = prior ? maxWallHeight(prior) : next;
    if (next > MAX_STOREY_M && next > prev + 0.05) {
      if (!worst || next > worst.next) {
        worst = { name: floor.name, prev, next };
      }
    }
  }
  return worst;
}

function maxWallHeight(floor: Floor): number {
  return floor.walls.reduce((tallest, wall) => Math.max(tallest, wall.height), 0);
}

function oversizedRoom(plan: FloorPlan): { name: string; span: number } | null {
  let worst: { name: string; span: number } | null = null;
  for (const floor of plan.floors) {
    for (const room of floor.rooms) {
      const xs = room.boundary.map((point) => point.x);
      const ys = room.boundary.map((point) => point.y);
      if (xs.length === 0) {
        continue;
      }
      const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      if (span > MAX_ROOM_SIDE_M && (!worst || span > worst.span)) {
        worst = { name: room.name, span };
      }
    }
  }
  return worst;
}

function oversizedOpening(plan: FloorPlan): { name: string; size: number } | null {
  let worst: { name: string; size: number } | null = null;
  for (const floor of plan.floors) {
    for (const opening of floor.openings) {
      const size = Math.max(opening.width, opening.height);
      if (size > MAX_OPENING_M && (!worst || size > worst.size)) {
        worst = { name: opening.id, size };
      }
    }
  }
  return worst;
}

/**
 * The catch-all: whatever the actions were called, compare the shell before and
 * after. This is what catches a model that moves the walls itself rather than
 * asking for an area.
 */
function reviewShell(plan: FloorPlan, actions: AgentAction[]): EditNotice | null {
  const after = actions.reduce(applyAgentAction, plan);
  const moves = plan.floors
    .map((floor) => {
      const next = after.floors.find((entry) => entry.id === floor.id);
      const from = plateOf(floor);
      const to = next ? plateOf(next) : null;
      return from && to ? { name: floor.name, from, to } : null;
    })
    .filter((move): move is NonNullable<typeof move> => move !== null);
  const moved = moves.filter((move) => travel(move.from, move.to) > FACE_EPS);
  if (moved.length === 0) {
    return null;
  }
  // Every storey moved by the same amount: the whole shell grew or shrank, and
  // the storeys still stand on one footprint.
  const together =
    moved.length === moves.length &&
    moved.every((move) => sameShift(move, moved[0]));
  const worst = moved.reduce((best, move) =>
    travel(move.from, move.to) > travel(best.from, best.to) ? move : best,
  );
  const distance = trim(travel(worst.from, worst.to));
  return {
    severity: together ? "grows-footprint" : "overhangs",
    title: together
      ? "This edit changes the building's footprint"
      : "This edit moves one storey out of line",
    detail: together
      ? `The outside wall moves ${distance} m on all ${moves.length} ${
          moves.length === 1 ? "storey" : "storeys"
        }, so the footprint goes from ${trim(area(worst.from))} to ${trim(
          area(worst.to),
        )} m².`
      : `${worst.name}'s wall moves ${distance} m while the other storeys stay where they are, so they no longer stand on one footprint.`,
    asked: actions,
    trimmed: [],
  };
}

interface Plate {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function plateOf(floor: Floor): Plate | null {
  const points: Point2D[] = floor.walls.flatMap((wall) => [wall.start, wall.end]);
  if (points.length === 0) {
    return null;
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/** The furthest any one face travelled. */
function travel(from: Plate, to: Plate): number {
  return Math.max(...faces(from, to).map(Math.abs));
}

function faces(from: Plate, to: Plate): number[] {
  return [to.minX - from.minX, to.maxX - from.maxX, to.minY - from.minY, to.maxY - from.maxY];
}

function sameShift(
  left: { from: Plate; to: Plate },
  right: { from: Plate; to: Plate },
): boolean {
  const a = faces(left.from, left.to);
  const b = faces(right.from, right.to);
  return a.every((value, index) => Math.abs(value - b[index]) <= FACE_EPS);
}

function area(plate: Plate): number {
  return (plate.maxX - plate.minX) * (plate.maxY - plate.minY);
}

function describeResize(preview: RoomResizePreview): string {
  const fits = `${preview.roomName} fits ${trim(preview.maxAreaSqM)} m² on this plate.`;
  if (preview.outcome === "grows-footprint") {
    return `${fits} Reaching ${trim(preview.requestedSqM)} m² moves the outside wall ${trim(
      preview.moveMeters,
    )} m on all ${preview.storeys} storeys, so the footprint grows from ${trim(
      preview.footprintBefore,
    )} to ${trim(preview.footprintAfter)} m².`;
  }
  return `${fits} Reaching ${trim(preview.requestedSqM)} m² pushes ${
    preview.floorName
  }'s wall ${trim(preview.moveMeters)} m past the rest of the building, leaving the storeys around it hanging over open air.`;
}

/** 36 rather than 36.00, but 8.36 kept whole. */
function trim(value: number): string {
  return String(Number(value.toFixed(2)));
}
