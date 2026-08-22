import type { ElectricalRun, Floor, FloorPlan, PipeRun, Room, RoutePoint } from "../types/floorPlan";
import type { AgentAction } from "./types";

/**
 * "Add a cable in the living room" comes back from the model as a patch with a
 * room name and no run id, because a new run has no id to give. Rather than
 * dropping it, the run is routed across the named room the way the MEP layout
 * would have drawn it.
 */
export function serviceAddition(
  plan: FloorPlan,
  kind: "electrical" | "pipe",
  hints: Record<string, unknown>,
  userText: string,
): AgentAction | null {
  const found = locateRoom(plan, hints, userText);
  if (!found) {
    return null;
  }
  const { floor, room } = found;
  const label = `${text(hints)} ${userText}`.toLowerCase();
  const box = bounds(room);

  if (kind === "electrical") {
    const circuit = /light/.test(label) ? "lighting" : /data|network|ethernet/.test(label) ? "data" : "power";
    const height = circuit === "power" ? 0.4 : Math.max(2.4, room.floorHeight + 2.4);
    const run: ElectricalRun = {
      id: uniqueId(floor.electrical.map((entry) => entry.id), `${floor.id}-elec-added`),
      name: `${titles[circuit]} — ${room.name}`,
      circuit,
      diameter: circuit === "power" ? 0.025 : 0.02,
      points: across(box, height),
    };
    return { type: "add_electrical", floorId: floor.id, run };
  }

  const system = /waste|drain|soil/.test(label)
    ? "waste"
    : /vent/.test(label)
      ? "vent"
      : /gas/.test(label)
        ? "gas"
        : "supply";
  const run: PipeRun = {
    id: uniqueId(floor.pipes.map((entry) => entry.id), `${floor.id}-pipe-added`),
    name: `${titles[system]} — ${room.name}`,
    system,
    diameter: system === "waste" ? 0.075 : 0.032,
    points: across(box, system === "waste" ? 0.22 : 0.6),
  };
  return { type: "add_pipe", floorId: floor.id, pipe: run };
}

const titles: Record<string, string> = {
  power: "Small power",
  lighting: "Lighting",
  data: "Data",
  supply: "Supply",
  waste: "Waste",
  vent: "Vent",
  gas: "Gas",
};

function locateRoom(
  plan: FloorPlan,
  hints: Record<string, unknown>,
  userText: string,
): { floor: Floor; room: Room } | null {
  const needles = [
    ...["room", "roomId", "target", "location", "zone", "name"]
      .map((key) => hints[key])
      .filter((value): value is string => typeof value === "string"),
    userText,
  ];
  for (const needle of needles) {
    const found = matchRoom(plan, needle);
    if (found) {
      return found;
    }
  }
  return null;
}

function matchRoom(
  plan: FloorPlan,
  needle: string,
): { floor: Floor; room: Room } | null {
  const clean = needle.trim().toLowerCase();
  if (!clean) {
    return null;
  }
  for (const floor of plan.floors) {
    const room = floor.rooms.find((entry) => entry.id.toLowerCase() === clean);
    if (room) {
      return { floor, room };
    }
  }
  // "l3 living room" and "l3-living" both have to find the same room, so the
  // storey prefix is matched separately from the room words.
  const prefixed = clean.match(/\bl(\d+)\b/);
  const floors = prefixed
    ? plan.floors.filter((floor) => floor.id.toLowerCase() === `l${prefixed[1]}`)
    : plan.floors;
  const words = clean
    .replace(/\bl\d+\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 2 && !STOP.has(word));
  if (words.length === 0) {
    return null;
  }
  let best: { floor: Floor; room: Room; score: number } | null = null;
  for (const floor of floors.length > 0 ? floors : plan.floors) {
    for (const room of floor.rooms) {
      const haystack = `${room.id} ${room.name}`.toLowerCase();
      const score = words.filter((word) => haystack.includes(word)).length;
      if (score > 0 && (!best || score > best.score)) {
        best = { floor, room, score };
      }
    }
  }
  return best ? { floor: best.floor, room: best.room } : null;
}

const STOP = new Set([
  "the",
  "and",
  "add",
  "extra",
  "another",
  "need",
  "want",
  "please",
  "cable",
  "wire",
  "wiring",
  "circuit",
  "electric",
  "electrical",
  "pipe",
  "run",
  "line",
  "for",
  "into",
  "inside",
]);

function bounds(room: Room) {
  const xs = room.boundary.map((point) => point.x);
  const ys = room.boundary.map((point) => point.y);
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  };
}

/** A spur down the room's long axis, inset off the wall like the layout does. */
function across(
  box: { x0: number; x1: number; y0: number; y1: number },
  height: number,
): RoutePoint[] {
  const inset = 0.45;
  const wide = box.x1 - box.x0 >= box.y1 - box.y0;
  const at = round(wide ? (box.y0 + box.y1) / 2 : (box.x0 + box.x1) / 2);
  return wide
    ? [
        { x: round(box.x0 + inset), y: at, height: round(height) },
        { x: round(box.x1 - inset), y: at, height: round(height) },
      ]
    : [
        { x: at, y: round(box.y0 + inset), height: round(height) },
        { x: at, y: round(box.y1 - inset), height: round(height) },
      ];
}

function uniqueId(taken: string[], base: string): string {
  let index = 1;
  let id = `${base}-${index}`;
  while (taken.includes(id)) {
    index += 1;
    id = `${base}-${index}`;
  }
  return id;
}

function text(hints: Record<string, unknown>): string {
  return Object.values(hints)
    .filter((value): value is string => typeof value === "string")
    .join(" ");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
