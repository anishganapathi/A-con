import { findNamed } from "../editor/floorPlanEdits";
import type { FloorPlan, Opening, Selection } from "../types/floorPlan";
import { serviceAddition } from "./addService";
import type { AgentAction } from "./types";

/**
 * Map a VL guess onto IDs that exist, and drop edits that would not change
 * the live model — especially the canned 40 m² example from the vision prompt.
 */
export function bindVisionEdits(
  plan: FloorPlan,
  actions: AgentAction[],
  userText = "",
): AgentAction[] {
  const bound: AgentAction[] = [];
  for (const raw of actions) {
    const action = coerceAction(raw);
    if (!action) {
      continue;
    }
    if (action.type === "patch_electrical" || action.type === "patch_pipe") {
      const kind = action.type === "patch_electrical" ? "electrical" : "pipe";
      const wanted =
        action.type === "patch_electrical" ? action.runId : action.pipeId;
      const target = findRun(plan, kind, wanted);
      // The model spells a deletion as a patch carrying "action": "remove".
      const removing = removalIntent(action.patch);
      if (target) {
        bound.push(
          removing
            ? {
                type: "remove",
                selection: { kind, id: target.id },
                label: `${kind === "pipe" ? "pipe" : "circuit"} ${target.name}`,
              }
            : action,
        );
        continue;
      }
      if (removing) {
        continue;
      }
      // No such run: the model meant "add one here", which is the only thing it
      // can express when the run it is describing does not exist yet.
      const addition = serviceAddition(plan, kind, action.patch ?? {}, userText);
      if (addition) {
        bound.push(addition);
      }
      continue;
    }
    if (action.type === "remove") {
      const selection = resolveSelection(plan, action.selection, raw);
      if (!selection) {
        continue;
      }
      bound.push({ type: "remove", selection, label: labelFor(plan, selection) });
      continue;
    }
    if (action.type === "add_electrical" || action.type === "add_pipe") {
      const kind = action.type === "add_electrical" ? "electrical" : "pipe";
      const supplied = action.type === "add_electrical" ? action.run : action.pipe;
      // The model names the room; the route is ours to draw.
      if (!routable(supplied)) {
        const addition = serviceAddition(plan, kind, hintsOf(action), userText);
        if (addition) {
          bound.push(addition);
        }
        continue;
      }
      bound.push(action);
      continue;
    }
    if (action.type === "resize_room") {
      const roomId = resolveRoomId(plan, action.roomId);
      if (!roomId) {
        continue;
      }
      const current = roomArea(plan, roomId);
      if (current !== null && Math.abs(current - action.areaSqM) < 0.51) {
        continue;
      }
      bound.push({ ...action, roomId });
      continue;
    }
    if (action.type === "patch_roof") {
      if (!roofWouldChange(plan, action.patch)) {
        continue;
      }
      bound.push(action);
      continue;
    }
    if (action.type === "patch_room") {
      const roomId = resolveRoomId(plan, action.roomId);
      if (!roomId) {
        continue;
      }
      bound.push({ ...action, roomId });
      continue;
    }
    if (action.type === "patch_opening") {
      const openingId = resolveOpeningId(plan, action.openingId);
      if (!openingId) {
        continue;
      }
      const patch = openingPatch(plan, openingId, action.patch);
      if (!patch) {
        continue;
      }
      bound.push({ ...action, openingId, patch });
      continue;
    }
    if (action.type === "patch_wall") {
      if (!findId(plan, "wall", action.wallId)) {
        continue;
      }
      bound.push(action);
      continue;
    }
    bound.push(action);
  }
  return bound;
}

export function visionEditReply(modelReply: string, actions: AgentAction[]): string {
  const seen = modelReply
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "I read the elevation.";
  const look = seen
    .replace(/\s*to match the elevation[\s\S]*$/i, ".")
    .replace(/\s*the roof was patched[\s\S]*$/i, ".")
    .trim();

  if (actions.length === 0) {
    return [
      look,
      "",
      "The drawing came through, but nothing on the live model changed. Edit mode cannot add extra gables, a chimney, or a stepped wing — those need a rebuild. I also ignored invented room sizes that were not on the sheet.",
    ].join("\n");
  }
  return look;
}

function coerceAction(action: AgentAction | null | undefined): AgentAction | null {
  if (!action || typeof action !== "object" || !action.type) {
    return null;
  }
  if (action.type === "resize_room") {
    return typeof action.roomId === "string" && Number.isFinite(action.areaSqM)
      ? action
      : null;
  }
  if (
    action.type === "patch_roof" ||
    action.type === "patch_wall" ||
    action.type === "patch_room" ||
    action.type === "patch_opening" ||
    action.type === "patch_pipe" ||
    action.type === "patch_electrical"
  ) {
    const existing = asRecord(action.patch);
    const patch = unwrapPatch(existing ?? liftedPatch(action));
    if (!patch || Object.keys(patch).length === 0) {
      return null;
    }
    if (existing) {
      return { ...action, patch } as AgentAction;
    }
    const clean = { type: action.type, patch } as AgentAction;
    return attachTarget(clean, action);
  }
  return action;
}

const OPENING_FIELDS: Record<string, "offsetFromStart" | "width" | "height" | "sillHeight"> = {
  offsetfromstart: "offsetFromStart",
  offset: "offsetFromStart",
  position: "offsetFromStart",
  start: "offsetFromStart",
  x: "offsetFromStart",
  width: "width",
  w: "width",
  height: "height",
  h: "height",
  sillheight: "sillHeight",
  sill: "sillHeight",
};

/** Keys that mean "move it by this much" rather than "put it here". */
const OPENING_SHIFTS = new Set(["shift", "delta", "moveby", "dx", "offsetdelta"]);

/**
 * Models describe openings loosely — `{x: 1}`, `{w: 10}`, `"+0.5"` — and a raw
 * spread of that onto an Opening either does nothing or slides it off the wall.
 * Every key is mapped onto a real field, held inside the host wall, and the
 * patch is dropped entirely when it would not move anything.
 */
function openingPatch(
  plan: FloorPlan,
  openingId: string,
  raw: Record<string, unknown> | undefined,
): Record<string, number> | null {
  const located = locateOpening(plan, openingId);
  if (!located || !raw) {
    return null;
  }
  const { opening, wallLength } = located;
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    const flat = key.toLowerCase().replace(/[\s_-]/g, "");
    const field = OPENING_SHIFTS.has(flat) ? "offsetFromStart" : OPENING_FIELDS[flat];
    if (!field) {
      continue;
    }
    const current = next[field] ?? opening[field];
    const parsed = asDistance(value, OPENING_SHIFTS.has(flat));
    if (!parsed) {
      continue;
    }
    next[field] = parsed.relative ? current + parsed.value : parsed.value;
  }
  if (Object.keys(next).length === 0) {
    return null;
  }

  const span = wallLength > 0 ? wallLength : opening.offsetFromStart + opening.width;
  if (next.width !== undefined) {
    next.width = clamp(next.width, 0.3, Math.max(0.3, span - 0.2));
  }
  if (next.height !== undefined) {
    next.height = clamp(next.height, 0.3, 3);
  }
  if (next.sillHeight !== undefined) {
    next.sillHeight = clamp(next.sillHeight, 0, 2.4);
  }
  if (next.offsetFromStart !== undefined) {
    const width = next.width ?? opening.width;
    next.offsetFromStart = clamp(next.offsetFromStart, 0.1, Math.max(0.1, span - width - 0.1));
  }

  // Claiming an update the geometry never received is worse than saying no.
  const moved: Record<string, number> = {};
  for (const [field, value] of Object.entries(next)) {
    const before = opening[field as "offsetFromStart" | "width" | "height" | "sillHeight"];
    if (Math.abs(value - before) >= 0.01) {
      moved[field] = round(value);
    }
  }
  return Object.keys(moved).length > 0 ? moved : null;
}

function locateOpening(
  plan: FloorPlan,
  openingId: string,
): { opening: Opening; wallLength: number } | null {
  for (const floor of plan.floors) {
    const opening = floor.openings.find((entry) => entry.id === openingId);
    if (!opening) {
      continue;
    }
    const wall = floor.walls.find((entry) => entry.id === opening.wallId);
    const wallLength = wall
      ? Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y)
      : 0;
    return { opening, wallLength };
  }
  return null;
}

function asDistance(
  value: unknown,
  forceRelative: boolean,
): { value: number; relative: boolean } | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? { value, relative: forceRelative } : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim();
  const match = text.match(/^([+-]?)\s*([\d.]+)/);
  if (!match || !Number.isFinite(Number(match[2]))) {
    return null;
  }
  const magnitude = Number(match[2]) * (match[1] === "-" ? -1 : 1);
  const unit = /\b(cm|mm)\b/i.exec(text)?.[1]?.toLowerCase();
  const metres = unit === "cm" ? magnitude / 100 : unit === "mm" ? magnitude / 1000 : magnitude;
  return { value: metres, relative: forceRelative || match[1] !== "" };
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const PATCH_ENVELOPES = ["properties", "props", "values", "attributes", "changes", "updates"];

/** Models often nest the real fields one level down; flatten that envelope. */
function unwrapPatch(patch: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!patch) {
    return null;
  }
  let flat = patch;
  for (const key of PATCH_ENVELOPES) {
    const nested = asRecord(flat[key]);
    if (nested) {
      const { [key]: _dropped, ...rest } = flat;
      flat = { ...rest, ...nested };
    }
  }
  return flat;
}

function attachTarget(action: AgentAction, raw: object): AgentAction {
  const source = raw as Record<string, unknown>;
  // Models reach for a plain "id" as often as the typed key, so both are read.
  const pick = (key: string) => {
    const value = source[key] ?? source.id;
    return typeof value === "string" ? value : undefined;
  };
  if (action.type === "patch_wall" && pick("wallId")) {
    return { ...action, wallId: pick("wallId")! };
  }
  if (action.type === "patch_room" && pick("roomId")) {
    return { ...action, roomId: pick("roomId")! };
  }
  if (action.type === "patch_opening" && pick("openingId")) {
    return { ...action, openingId: pick("openingId")! };
  }
  if (action.type === "patch_pipe" && pick("pipeId")) {
    return { ...action, pipeId: pick("pipeId")! };
  }
  if (action.type === "patch_electrical" && pick("runId")) {
    return { ...action, runId: pick("runId")! };
  }
  return action;
}

function liftedPatch(action: object): Record<string, unknown> | null {
  const skip = new Set([
    "type",
    "id",
    "wallId",
    "roomId",
    "openingId",
    "pipeId",
    "runId",
    "patch",
  ]);
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(action)) {
    if (!skip.has(key) && value !== undefined) {
      patch[key] = value;
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

export function resolveRoomId(plan: FloorPlan, raw: string | undefined): string | null {
  const needle = raw?.trim().toLowerCase() ?? "";
  if (!needle) {
    return null;
  }
  for (const floor of plan.floors) {
    const exact = floor.rooms.find((room) => room.id.toLowerCase() === needle);
    if (exact) {
      return exact.id;
    }
  }
  const prefixed = needle.match(/^(l\d+)[-_\s]+(.+)$/);
  if (prefixed) {
    const floor =
      plan.floors.find((entry) => entry.id.toLowerCase() === prefixed[1]) ??
      (prefixed[1] === "l1" ? plan.floors[0] : undefined);
    const rest = prefixed[2];
    const match = floor?.rooms.find(
      (room) =>
        room.id.toLowerCase() === rest ||
        room.id.toLowerCase().endsWith(`-${rest}`) ||
        room.name.toLowerCase().includes(rest.replace(/-/g, " ")),
    );
    if (match) {
      return match.id;
    }
  }
  const named = findNamed(plan, needle.replace(/-/g, " "));
  return named?.selection.kind === "room" ? named.selection.id : null;
}

function roomArea(plan: FloorPlan, roomId: string): number | null {
  for (const floor of plan.floors) {
    const room = floor.rooms.find((entry) => entry.id === roomId);
    if (room) {
      return room.areaSqM ?? null;
    }
  }
  return null;
}

function findId(plan: FloorPlan, _kind: "wall", id: string): boolean {
  return plan.floors.some((floor) => floor.walls.some((wall) => wall.id === id));
}

/** A run the model supplied is only usable if it actually has a route. */
function routable(run: unknown): boolean {
  const points = (run as { points?: unknown })?.points;
  return (
    Array.isArray(points) &&
    points.length >= 2 &&
    points.every(
      (point) =>
        Number.isFinite((point as { x?: number })?.x) &&
        Number.isFinite((point as { y?: number })?.y),
    )
  );
}

function hintsOf(action: object): Record<string, unknown> {
  const source = action as Record<string, unknown>;
  const nested = (source.run ?? source.pipe) as Record<string, unknown> | undefined;
  return { ...source, ...(nested && typeof nested === "object" ? nested : {}) };
}

function findRun(
  plan: FloorPlan,
  kind: "electrical" | "pipe",
  id: string | undefined,
): { id: string; name: string } | null {
  if (!id) {
    return null;
  }
  const needle = id.trim().toLowerCase();
  for (const floor of plan.floors) {
    const run = (kind === "electrical" ? floor.electrical : floor.pipes).find(
      (entry) => entry.id.toLowerCase() === needle,
    );
    if (run) {
      return { id: run.id, name: run.name };
    }
  }
  return null;
}

/** What the chat should call the thing that just disappeared. */
function labelFor(plan: FloorPlan, selection: Selection): string | undefined {
  if (selection.kind === "pipe" || selection.kind === "electrical") {
    const run = findRun(plan, selection.kind, selection.id);
    return run
      ? `${selection.kind === "pipe" ? "pipe" : "circuit"} ${run.name}`
      : undefined;
  }
  if (selection.kind === "room") {
    for (const floor of plan.floors) {
      const room = floor.rooms.find((entry) => entry.id === selection.id);
      if (room) {
        return `room ${room.name}`;
      }
    }
  }
  return undefined;
}

/** "action": "remove", "delete": true, and friends all mean the same thing. */
function removalIntent(patch: Record<string, unknown> | undefined): boolean {
  if (!patch) {
    return false;
  }
  for (const key of ["action", "op", "operation", "command", "mode"]) {
    const value = patch[key];
    if (typeof value === "string" && /^(remove|delete|drop)$/i.test(value.trim())) {
      return true;
    }
  }
  return ["remove", "delete", "deleted", "removed"].some(
    (key) => patch[key] === true,
  );
}

function resolveSelection(
  plan: FloorPlan,
  selection: Selection | undefined,
  raw: object,
): Selection | null {
  const source = raw as Record<string, unknown>;
  const id =
    selection?.id ??
    ["id", "pipeId", "runId", "wallId", "roomId", "openingId"]
      .map((key) => source[key])
      .find((value): value is string => typeof value === "string");
  if (!id) {
    return null;
  }
  // A kind the model guessed wrong is worse than no kind at all, so the plan
  // decides what this id actually is.
  const found = kindOf(plan, id);
  return found ? { kind: found, id } : null;
}

function kindOf(plan: FloorPlan, id: string): Selection["kind"] | null {
  const needle = id.trim().toLowerCase();
  for (const floor of plan.floors) {
    if (floor.pipes.some((pipe) => pipe.id.toLowerCase() === needle)) {
      return "pipe";
    }
    if (floor.electrical.some((run) => run.id.toLowerCase() === needle)) {
      return "electrical";
    }
    if (floor.walls.some((wall) => wall.id.toLowerCase() === needle)) {
      return "wall";
    }
    if (floor.rooms.some((room) => room.id.toLowerCase() === needle)) {
      return "room";
    }
    if (floor.openings.some((opening) => opening.id.toLowerCase() === needle)) {
      return "opening";
    }
  }
  return null;
}

function resolveOpeningId(plan: FloorPlan, raw: string | undefined): string | null {
  const needle = raw?.trim().toLowerCase() ?? "";
  if (!needle) {
    return null;
  }
  for (const floor of plan.floors) {
    const exact = floor.openings.find((opening) => opening.id.toLowerCase() === needle);
    if (exact) {
      return exact.id;
    }
  }
  const south = needle.replace(/^l1[-_]?/, "");
  for (const floor of plan.floors) {
    const match = floor.openings.find(
      (opening) =>
        opening.id.toLowerCase() === south ||
        opening.id.toLowerCase().endsWith(`-${south}`),
    );
    if (match) {
      return match.id;
    }
  }
  return null;
}

function roofWouldChange(plan: FloorPlan, patch: Record<string, unknown> | undefined): boolean {
  if (!patch || Object.keys(patch).length === 0) {
    return false;
  }
  if (Object.keys(patch).length === 1 && patch.visible === true && plan.roof.visible !== false) {
    return false;
  }
  const numeric = ["eaveHeight", "ridgeHeight", "overhang"] as const;
  let compared = 0;
  for (const key of numeric) {
    const next = patch[key];
    if (typeof next !== "number") {
      continue;
    }
    compared += 1;
    if (Math.abs(next - plan.roof[key]) >= 0.15) {
      return true;
    }
  }
  if (typeof patch.visible === "boolean" && patch.visible !== (plan.roof.visible !== false)) {
    return true;
  }
  if (typeof patch.type === "string" && patch.type !== plan.roof.type) {
    return true;
  }
  return compared === 0 && Object.keys(patch).some((key) => !numeric.includes(key as never) && key !== "visible" && key !== "type");
}
