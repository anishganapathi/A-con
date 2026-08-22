import type { Floor, FloorPlan, Opening, Wall } from "../types/floorPlan";
import { applyAgentAction } from "./applyAction";
import type { AgentAction } from "./types";

export interface ElevationBrief {
  face?: "front" | "south" | "north";
  eaveHeight?: number;
  ridgeHeight?: number;
  windowWidth?: number;
  windowHeight?: number;
  sillHeight?: number;
  windowsPerFloor?: number | number[];
  doorWidth?: number;
}

/**
 * Restage the live front wall and gable from measured (or default) bays.
 * The VL cannot invent opening IDs; this writes onto ext-south / ext-north.
 */
export function applyElevationMatch(
  plan: FloorPlan,
  brief: ElevationBrief = {},
): AgentAction[] {
  const face = brief.face === "north" ? "north" : "south";
  const actions: AgentAction[] = [];
  const roof = roofPatch(plan, brief, face);
  if (roof) {
    actions.push({ type: "patch_roof", patch: roof });
  }
  const fronts = frontWalls(plan, face);
  fronts.forEach(({ floor, wall }, index) => {
    actions.push(...layoutFrontFloor(floor, wall, brief, index === 0));
  });
  return actions.filter((action) => changesPlan(plan, action));
}

export function elevationMatchReply(modelReply: string, _actions: AgentAction[]): string {
  const first = modelReply
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  const saw = first && !/updated the roof/i.test(first) ? first : null;
  return [
    saw,
    "I restaged the front elevation on the live model: window bays and a steeper single gable.",
    "I cannot add extra gables, a dormer, or a chimney from the drawing — those need a rebuild.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function facadeChanged(before: FloorPlan, actions: AgentAction[]): boolean {
  if (actions.length === 0) {
    return false;
  }
  const after = actions.reduce(applyAgentAction, before);
  return facadeSignature(before) !== facadeSignature(after);
}

function roofPatch(
  plan: FloorPlan,
  brief: ElevationBrief,
  face: "south" | "north",
): { eaveHeight: number; ridgeHeight: number } | null {
  const span = frontSpan(plan, face);
  const eave = finite(brief.eaveHeight) ?? plan.roof.eaveHeight;
  const requested = finite(brief.ridgeHeight);
  const copiedLive =
    requested === undefined ||
    (Math.abs(requested - plan.roof.ridgeHeight) < 0.25 &&
      Math.abs(eave - plan.roof.eaveHeight) < 0.25);
  const ridge = copiedLive
    ? eave + Math.max(3.4, span * 0.34)
    : Math.max(eave + 1.2, requested);
  if (
    Math.abs(eave - plan.roof.eaveHeight) < 0.08 &&
    Math.abs(ridge - plan.roof.ridgeHeight) < 0.08
  ) {
    return null;
  }
  return { eaveHeight: round(eave), ridgeHeight: round(ridge) };
}

function layoutFrontFloor(
  floor: Floor,
  wall: Wall,
  brief: ElevationBrief,
  ground: boolean,
): AgentAction[] {
  const length = wallLength(wall);
  const count = windowsOnFloor(brief, floor);
  const windowWidth = clamp(finite(brief.windowWidth) ?? (ground ? 1.05 : 1.0), 0.7, 2.2);
  const windowHeight = clamp(finite(brief.windowHeight) ?? (ground ? 1.6 : 1.5), 0.8, 2.6);
  const sillHeight = clamp(finite(brief.sillHeight) ?? 0.85, 0.4, 1.6);
  const doorWidth = clamp(finite(brief.doorWidth) ?? 1.1, 0.8, 1.6);
  const existingWindows = floor.openings
    .filter((opening) => opening.wallId === wall.id && opening.type === "window")
    .sort((a, b) => a.offsetFromStart - b.offsetFromStart);
  const existingDoor = floor.openings.find(
    (opening) => opening.wallId === wall.id && opening.type === "door",
  );

  const slots: { kind: "window" | "door"; width: number }[] = ground
    ? [
        { kind: "window", width: windowWidth },
        { kind: "door", width: doorWidth },
        { kind: "window", width: windowWidth },
        ...Array.from({ length: Math.max(0, count - 2) }, () => ({
          kind: "window" as const,
          width: windowWidth,
        })),
      ]
    : Array.from({ length: count }, () => ({ kind: "window" as const, width: windowWidth }));

  const offsets = packAlong(length, slots.map((slot) => slot.width));
  const actions: AgentAction[] = [];
  let windowIndex = 0;

  slots.forEach((slot, index) => {
    const offset = offsets[index];
    if (slot.kind === "door") {
      if (existingDoor) {
        actions.push({
          type: "patch_opening",
          openingId: existingDoor.id,
          patch: { offsetFromStart: offset, width: doorWidth, height: 2.3, sillHeight: 0 },
        });
      } else {
        actions.push({
          type: "add_opening",
          floorId: floor.id,
          opening: {
            id: `${floor.id}-door-front`,
            wallId: wall.id,
            type: "door",
            offsetFromStart: offset,
            width: doorWidth,
            height: 2.3,
            sillHeight: 0,
          },
        });
      }
      return;
    }
    const current = existingWindows[windowIndex];
    windowIndex += 1;
    if (current) {
      actions.push({
        type: "patch_opening",
        openingId: current.id,
        patch: {
          offsetFromStart: offset,
          width: windowWidth,
          height: windowHeight,
          sillHeight,
        },
      });
      return;
    }
    actions.push({
      type: "add_opening",
      floorId: floor.id,
      opening: {
        id: `${floor.id}-win-front-${index}`,
        wallId: wall.id,
        type: "window",
        offsetFromStart: offset,
        width: windowWidth,
        height: windowHeight,
        sillHeight,
      },
    });
  });

  for (const extra of existingWindows.slice(windowIndex)) {
    actions.push({ type: "remove", selection: { kind: "opening", id: extra.id } });
  }
  return actions;
}

function windowsOnFloor(brief: ElevationBrief, floor: Floor): number {
  const listed = brief.windowsPerFloor;
  if (typeof listed === "number") {
    return clamp(Math.round(listed), 2, 6);
  }
  if (Array.isArray(listed)) {
    const index = Math.max(0, Number.parseInt(floor.id.replace(/\D/g, ""), 10) - 1);
    const value = listed[index] ?? listed[listed.length - 1];
    if (typeof value === "number") {
      return clamp(Math.round(value), 2, 6);
    }
  }
  return floor.elevation === 0 ? 2 : 3;
}

function packAlong(length: number, widths: number[]): number[] {
  const used = widths.reduce((sum, width) => sum + width, 0);
  const gap = Math.max(0.35, (length - used) / (widths.length + 1));
  let cursor = gap;
  return widths.map((width) => {
    const offset = round(cursor);
    cursor += width + gap;
    return offset;
  });
}

function frontWalls(
  plan: FloorPlan,
  face: "south" | "north",
): { floor: Floor; wall: Wall }[] {
  const needle = face === "north" ? "ext-north" : "ext-south";
  return plan.floors
    .filter((floor) => floor.occupiable !== false)
    .flatMap((floor) => {
      const wall = floor.walls.find(
        (entry) => entry.id === needle || entry.id.endsWith(`-${needle}`),
      );
      return wall ? [{ floor, wall }] : [];
    });
}

function frontSpan(plan: FloorPlan, face: "south" | "north"): number {
  const first = frontWalls(plan, face)[0];
  return first ? wallLength(first.wall) : 10;
}

function wallLength(wall: Wall): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

function facadeSignature(plan: FloorPlan): string {
  return JSON.stringify({
    roof: [plan.roof.eaveHeight, plan.roof.ridgeHeight],
    openings: plan.floors.flatMap((floor) =>
      floor.openings
        .filter((opening) => /ext-south|ext-north/.test(opening.wallId))
        .map((opening) => openingKey(opening)),
    ),
  });
}

function openingKey(opening: Opening): unknown[] {
  return [
    opening.id,
    opening.offsetFromStart,
    opening.width,
    opening.height,
    opening.sillHeight,
  ];
}

function changesPlan(plan: FloorPlan, action: AgentAction): boolean {
  const next = applyAgentAction(plan, action);
  return JSON.stringify(next) !== JSON.stringify(plan);
}

function finite(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
