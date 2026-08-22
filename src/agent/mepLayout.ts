import type { BuildingSpec, ZoneSpec } from "./buildingSpec";
import type { ElectricalRun, PipeRun, Point2D, RoutePoint } from "../types/floorPlan";

/**
 * Services are coordinated the way a real set of drawings resolves them: every
 * system gets its own reserved band in the ceiling plenum and its own lane in
 * the riser shaft, and horizontal runs stay orthogonal — along the corridor
 * spine, then a right-angle spur into the space. Nothing cuts diagonally
 * across a plate and no two systems occupy the same coordinate.
 */

/** Depth of each service below the slab above, in meters. */
const PLENUM = {
  supply: 0.46,
  vent: 0.36,
  power: 0.29,
  data: 0.22,
  lighting: 0.14,
} as const;

/** Waste falls under the floor, so it sits just above this slab instead. */
const WASTE_INVERT = 0.18;
const FIXTURE_HEIGHT = 0.9;

/** Lane offsets inside the shaft, so the four stacks never share a line. */
const LANES = {
  waste: { x: -1, y: -1 },
  vent: { x: -1, y: 1 },
  supply: { x: 1, y: -1 },
  power: { x: 1, y: 1 },
  data: { x: 1, y: 0 },
} as const;

export interface MepPlan {
  /** Shaft centre, held constant for the whole building so risers stack. */
  riser: Point2D;
  /** Lane spacing, also fixed building-wide or the stacks would wander. */
  lane: number;
}

/**
 * Sets out the shaft once per building. Risers are only continuous if every
 * floor drops them at the same coordinate, so the anchor is taken from the
 * tightest plate — anything larger would put the stack outside a setback.
 */
export function riserAnchorFor(plates: Point2D[][]): MepPlan | null {
  let smallest: Point2D[] | null = null;
  let smallestArea = Infinity;
  for (const plate of plates) {
    const area = Math.abs(shoelace(plate));
    if (area > 1 && area < smallestArea) {
      smallestArea = area;
      smallest = plate;
    }
  }
  if (!smallest) {
    return null;
  }
  return {
    riser: centroid(smallest),
    lane: clamp(Math.sqrt(smallestArea) * 0.06, 0.35, 0.9),
  };
}

export function planPipes(
  spec: BuildingSpec,
  prefix: string,
  dense: boolean,
  anchor: MepPlan | null,
): PipeRun[] {
  const shaft = shaftOf(spec, anchor);
  const top = spec.storyHeight;
  const lane = shaft.lane;

  const runs: PipeRun[] = [
    riser(
      `${prefix}pipe-stack-waste`,
      "Waste stack",
      "waste",
      spec.typology === "retail" ? 0.15 : 0.1,
      offset(shaft.centre, LANES.waste, lane),
      top,
    ),
    riser(
      `${prefix}pipe-stack-vent`,
      "Vent stack",
      "vent",
      0.075,
      offset(shaft.centre, LANES.vent, lane),
      top,
    ),
    riser(
      `${prefix}pipe-stack-supply`,
      "Supply riser",
      "supply",
      0.05,
      offset(shaft.centre, LANES.supply, lane),
      top,
    ),
  ];

  const supplyOrigin = offset(shaft.centre, LANES.supply, lane);
  const wasteOrigin = offset(shaft.centre, LANES.waste, lane);
  const supplyHeight = top - PLENUM.supply;

  // The wet group is served by a loop around the core rather than a spray of
  // individual diagonals back to the stack.
  const loop = trunkLoop(spec, shaft, 0.55);
  if (loop.length > 0) {
    runs.push({
      id: `${prefix}pipe-main-supply`,
      name: "Domestic water main",
      system: "supply",
      diameter: 0.04,
      points: atHeight(connectToLoop(supplyOrigin, loop), supplyHeight),
    });
  }

  if (!dense) {
    return runs;
  }

  for (const zone of wetZones(spec)) {
    const fixture = insetPoint(zone, 0.4, 0.45);
    const tap = nearestOnLoop(loop, fixture) ?? supplyOrigin;
    runs.push({
      id: `${prefix}pipe-supply-${zone.id}`,
      name: `Supply — ${zone.name}`,
      system: "supply",
      diameter: 0.032,
      points: [
        ...atHeight(manhattan(tap, fixture), supplyHeight),
        { x: fixture.x, y: fixture.y, height: FIXTURE_HEIGHT },
      ],
    });
    runs.push({
      id: `${prefix}pipe-waste-${zone.id}`,
      name: `Waste — ${zone.name}`,
      system: "waste",
      diameter: 0.075,
      points: [
        { x: fixture.x, y: fixture.y, height: FIXTURE_HEIGHT - 0.3 },
        ...atHeight(manhattan(fixture, wasteOrigin), WASTE_INVERT),
      ],
    });
  }
  return runs;
}

export function planElectrical(
  spec: BuildingSpec,
  prefix: string,
  dense: boolean,
  anchor: MepPlan | null,
): ElectricalRun[] {
  const shaft = shaftOf(spec, anchor);
  const top = spec.storyHeight;
  const lane = shaft.lane;
  const powerOrigin = offset(shaft.centre, LANES.power, lane);
  const dataOrigin = offset(shaft.centre, LANES.data, lane);

  const runs: ElectricalRun[] = [
    riser(`${prefix}elec-riser`, "Electrical riser", "power", 0.05, powerOrigin, top),
    riser(`${prefix}elec-data-riser`, "Data riser", "data", 0.03, dataOrigin, top),
  ];

  // The distribution spine: a rectangular trunk hugging the core, which every
  // branch taps off. This is what keeps the plate readable.
  const powerLoop = trunkLoop(spec, shaft, 0.9);
  const dataLoop = trunkLoop(spec, shaft, 1.15);
  const powerHeight = top - PLENUM.power;
  const dataHeight = top - PLENUM.data;

  if (powerLoop.length > 0) {
    runs.push({
      id: `${prefix}elec-trunk-power`,
      name: "Power busway",
      circuit: "power",
      diameter: 0.045,
      points: atHeight(connectToLoop(powerOrigin, powerLoop), powerHeight),
    });
    runs.push({
      id: `${prefix}elec-trunk-data`,
      name: "Data containment",
      circuit: "data",
      diameter: 0.03,
      points: atHeight(connectToLoop(dataOrigin, dataLoop), dataHeight),
    });
  }

  if (!dense) {
    return runs;
  }

  const lightHeight = top - PLENUM.lighting;
  for (const zone of spec.zones) {
    if (zone.kind === "circulation") {
      continue;
    }
    // Luminaires run down the long axis of the space, fed by a right-angle
    // spur from the nearest point on the trunk.
    const [from, to] = longAxis(zone);
    const tap = nearestOnLoop(powerLoop, from) ?? powerOrigin;
    runs.push({
      id: `${prefix}elec-light-${zone.id}`,
      name: `Lighting — ${zone.name}`,
      circuit: "lighting",
      diameter: 0.02,
      points: atHeight([...manhattan(tap, from), to], lightHeight),
    });
  }

  for (const zone of spec.zones) {
    if (zone.kind !== "work" && zone.kind !== "living") {
      continue;
    }
    const outlet = insetPoint(zone, 0.5, 0.12);
    const tap = nearestOnLoop(powerLoop, outlet) ?? powerOrigin;
    runs.push({
      id: `${prefix}elec-power-${zone.id}`,
      name: `Small power — ${zone.name}`,
      circuit: "power",
      diameter: 0.025,
      points: [
        ...atHeight(manhattan(tap, outlet), powerHeight),
        { x: outlet.x, y: outlet.y, height: 0.4 },
      ],
    });
  }
  return runs;
}

interface Shaft {
  centre: Point2D;
  /** Half-width of the shaft, used to space the riser lanes apart. */
  lane: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

function shaftOf(spec: BuildingSpec, anchor: MepPlan | null): Shaft {
  const core =
    spec.zones.find((zone) => zone.kind === "circulation") ??
    spec.zones.find((zone) => zone.kind === "back") ??
    spec.zones[0];
  const wet = spec.zones.find((zone) => zone.kind === "wet");
  const host = wet ?? core;

  const centre = anchor?.riser ?? {
    x: (host?.x ?? spec.width / 2) + (host?.w ?? 2) / 2,
    y: (host?.y ?? spec.depth / 2) + (host?.h ?? 2) / 2,
  };
  const lane =
    anchor?.lane ?? clamp(Math.min(host?.w ?? 2, host?.h ?? 2) * 0.18, 0.3, 0.9);
  const bounds = core
    ? { minX: core.x, minY: core.y, maxX: core.x + core.w, maxY: core.y + core.h }
    : { minX: 0, minY: 0, maxX: spec.width, maxY: spec.depth };
  return { centre, lane, bounds };
}

/** A rectangular ring set out around the core, on the corridor line. */
function trunkLoop(spec: BuildingSpec, shaft: Shaft, gap: number): Point2D[] {
  const minX = round(clamp(shaft.bounds.minX - gap, 0.4, spec.width - 0.4));
  const maxX = round(clamp(shaft.bounds.maxX + gap, 0.4, spec.width - 0.4));
  const minY = round(clamp(shaft.bounds.minY - gap, 0.4, spec.depth - 0.4));
  const maxY = round(clamp(shaft.bounds.maxY + gap, 0.4, spec.depth - 0.4));
  if (maxX - minX < 1 || maxY - minY < 1) {
    return [];
  }
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
    { x: minX, y: minY },
  ];
}

/**
 * Feeds a trunk from its riser without cutting the corner: the tee leaves the
 * shaft square, and the loop is re-ordered to start where the feed lands.
 */
function connectToLoop(origin: Point2D, loop: Point2D[]): Point2D[] {
  if (loop.length < 2) {
    return [origin];
  }
  const ring = loop.slice(0, -1);
  let entry = 0;
  let best = Infinity;
  ring.forEach((corner, index) => {
    const distance = Math.abs(corner.x - origin.x) + Math.abs(corner.y - origin.y);
    if (distance < best) {
      best = distance;
      entry = index;
    }
  });
  const ordered = [...ring.slice(entry), ...ring.slice(0, entry)];
  return [...manhattan(origin, ordered[0]), ...ordered.slice(1), ordered[0]];
}

/** Right-angle route: run out on one axis, then turn onto the other. */
function manhattan(from: Point2D, to: Point2D): Point2D[] {
  if (Math.abs(from.x - to.x) < 0.05 || Math.abs(from.y - to.y) < 0.05) {
    return [from, to];
  }
  // Turn on the longer leg first so the spur leaves the trunk square to it.
  const elbow =
    Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
      ? { x: to.x, y: from.y }
      : { x: from.x, y: to.y };
  return [from, elbow, to];
}

function nearestOnLoop(loop: Point2D[], target: Point2D): Point2D | null {
  if (loop.length < 2) {
    return null;
  }
  let best: Point2D | null = null;
  let bestDistance = Infinity;
  for (let i = 0; i < loop.length - 1; i += 1) {
    const point = nearestOnSegment(loop[i], loop[i + 1], target);
    const distance = Math.hypot(point.x - target.x, point.y - target.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = point;
    }
  }
  return best;
}

function nearestOnSegment(a: Point2D, b: Point2D, p: Point2D): Point2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq < 0.0001) {
    return a;
  }
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq, 0, 1);
  return { x: round(a.x + dx * t), y: round(a.y + dy * t) };
}

/** Two points spanning the long axis of a zone, inset from its edges. */
function longAxis(zone: ZoneSpec): [Point2D, Point2D] {
  const inset = 0.28;
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h / 2;
  if (zone.w >= zone.h) {
    return [
      { x: round(zone.x + zone.w * inset), y: round(cy) },
      { x: round(zone.x + zone.w * (1 - inset)), y: round(cy) },
    ];
  }
  return [
    { x: round(cx), y: round(zone.y + zone.h * inset) },
    { x: round(cx), y: round(zone.y + zone.h * (1 - inset)) },
  ];
}

function wetZones(spec: BuildingSpec): ZoneSpec[] {
  return spec.zones.filter(
    (zone) => zone.kind === "wet" || /restroom|bath|kitchen|grocery/i.test(zone.name),
  );
}

function insetPoint(zone: ZoneSpec, fx: number, fy: number): Point2D {
  return {
    x: round(zone.x + zone.w * fx),
    y: round(zone.y + zone.h * fy),
  };
}

function offset(centre: Point2D, lane: { x: number; y: number }, size: number): Point2D {
  return { x: round(centre.x + lane.x * size), y: round(centre.y + lane.y * size) };
}

function atHeight(points: Point2D[], height: number): RoutePoint[] {
  return points.map((point) => ({ x: point.x, y: point.y, height: round(height) }));
}

function riser<T extends "waste" | "vent" | "supply">(
  id: string,
  name: string,
  system: T,
  diameter: number,
  at: Point2D,
  top: number,
): PipeRun;
function riser<T extends "power" | "data">(
  id: string,
  name: string,
  circuit: T,
  diameter: number,
  at: Point2D,
  top: number,
): ElectricalRun;
function riser(
  id: string,
  name: string,
  kind: string,
  diameter: number,
  at: Point2D,
  top: number,
) {
  const points: RoutePoint[] = [
    { x: at.x, y: at.y, height: 0 },
    { x: at.x, y: at.y, height: round(top) },
  ];
  return kind === "power" || kind === "data"
    ? { id, name, circuit: kind, diameter, points }
    : { id, name, system: kind, diameter, points };
}

function shoelace(polygon: Point2D[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function centroid(polygon: Point2D[]): Point2D {
  const area = shoelace(polygon);
  if (Math.abs(area) < 0.0001) {
    return polygon[0] ?? { x: 0, y: 0 };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const cross = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  return { x: round(cx / (6 * area)), y: round(cy / (6 * area)) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Number(value.toFixed(2));
}
