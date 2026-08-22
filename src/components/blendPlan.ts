import type {
  ElectricalRun,
  Floor,
  FloorPlan,
  Opening,
  PipeRun,
  Point2D,
  Room,
  RoutePoint,
  Wall,
} from "../types/floorPlan";

/** Long enough to read on a screen recording; short enough to not stall the demo. */
export const PLAN_TWEEN_MS = 1400;

export function easeOutCubic(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) ** 3;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Floors must line up by id and order. A rebuild replaces the building, and
 * the construction playback already covers that — blending mismatched
 * topology would slide rooms into the wrong places.
 */
export function sameTopology(from: FloorPlan, to: FloorPlan): boolean {
  if (from.floors.length !== to.floors.length) {
    return false;
  }
  return from.floors.every((floor, index) => floor.id === to.floors[index]?.id);
}

export function blendPlans(from: FloorPlan, to: FloorPlan, t: number): FloorPlan {
  if (t >= 1 || !sameTopology(from, to)) {
    return to;
  }
  if (t <= 0) {
    return from;
  }
  const amount = easeOutCubic(t);
  return {
    ...to,
    roof: {
      ...to.roof,
      eaveHeight: lerp(from.roof.eaveHeight, to.roof.eaveHeight, amount),
      ridgeHeight: lerp(from.roof.ridgeHeight, to.roof.ridgeHeight, amount),
      overhang: lerp(from.roof.overhang, to.roof.overhang, amount),
    },
    datums: to.datums.map((datum) => {
      const prior = from.datums.find((entry) => entry.id === datum.id);
      if (!prior) {
        return datum;
      }
      return { ...datum, elevation: lerp(prior.elevation, datum.elevation, amount) };
    }),
    floors: to.floors.map((floor, index) => blendFloor(from.floors[index], floor, amount)),
  };
}

function blendFloor(from: Floor, to: Floor, t: number): Floor {
  return {
    ...to,
    elevation: lerp(from.elevation, to.elevation, t),
    walls: to.walls.map((wall) => blendWall(findById(from.walls, wall.id), wall, t)),
    rooms: to.rooms.map((room) => blendRoom(findById(from.rooms, room.id), room, t)),
    openings: to.openings.map((opening) =>
      blendOpening(findById(from.openings, opening.id), opening, t),
    ),
    pipes: to.pipes.map((run) => blendRun(findById(from.pipes, run.id), run, t)),
    electrical: to.electrical.map((run) => blendRun(findById(from.electrical, run.id), run, t)),
  };
}

function blendWall(from: Wall | undefined, to: Wall, t: number): Wall {
  if (!from) {
    return to;
  }
  return {
    ...to,
    start: blendPoint(from.start, to.start, t),
    end: blendPoint(from.end, to.end, t),
    height: lerp(from.height, to.height, t),
    thickness: lerp(from.thickness, to.thickness, t),
  };
}

function blendRoom(from: Room | undefined, to: Room, t: number): Room {
  if (!from || from.boundary.length !== to.boundary.length) {
    return to;
  }
  return {
    ...to,
    boundary: to.boundary.map((point, index) => blendPoint(from.boundary[index], point, t)),
    labelPosition: blendPoint(from.labelPosition, to.labelPosition, t),
    floorHeight: lerp(from.floorHeight, to.floorHeight, t),
    areaSqM:
      from.areaSqM !== undefined && to.areaSqM !== undefined
        ? lerp(from.areaSqM, to.areaSqM, t)
        : to.areaSqM,
  };
}

function blendOpening(from: Opening | undefined, to: Opening, t: number): Opening {
  if (!from) {
    return to;
  }
  return {
    ...to,
    offsetFromStart: lerp(from.offsetFromStart, to.offsetFromStart, t),
    width: lerp(from.width, to.width, t),
    height: lerp(from.height, to.height, t),
    sillHeight: lerp(from.sillHeight, to.sillHeight, t),
  };
}

function blendRun<T extends PipeRun | ElectricalRun>(
  from: T | undefined,
  to: T,
  t: number,
): T {
  if (!from || from.points.length !== to.points.length) {
    return to;
  }
  return {
    ...to,
    diameter: lerp(from.diameter, to.diameter, t),
    points: to.points.map((point, index) => blendRoute(from.points[index], point, t)),
  };
}

function blendPoint(from: Point2D, to: Point2D, t: number): Point2D {
  return { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) };
}

function blendRoute(from: RoutePoint, to: RoutePoint, t: number): RoutePoint {
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    height: lerp(from.height, to.height, t),
  };
}

function findById<T extends { id: string }>(list: T[], id: string): T | undefined {
  return list.find((entry) => entry.id === id);
}
