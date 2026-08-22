import type {
  ElectricalRun,
  Floor,
  FloorPlan,
  Opening,
  PipeRun,
  Point2D,
  Room,
  Selection,
  Wall,
} from "../types/floorPlan";

export function updateActiveFloor(
  plan: FloorPlan,
  floorId: string,
  updater: (floor: Floor) => Floor,
): FloorPlan {
  return {
    ...plan,
    floors: plan.floors.map((floor) =>
      floor.id === floorId ? updater(floor) : floor,
    ),
  };
}

export function patchWall(floor: Floor, wallId: string, patch: Partial<Wall>): Floor {
  return {
    ...floor,
    walls: floor.walls.map((wall) =>
      wall.id === wallId ? { ...wall, ...patch } : wall,
    ),
  };
}

export function patchRoom(floor: Floor, roomId: string, patch: Partial<Room>): Floor {
  return {
    ...floor,
    rooms: floor.rooms.map((room) =>
      room.id === roomId ? { ...room, ...patch } : room,
    ),
  };
}

export function patchOpening(
  floor: Floor,
  openingId: string,
  patch: Partial<Opening>,
): Floor {
  return {
    ...floor,
    openings: floor.openings.map((opening) =>
      opening.id === openingId ? { ...opening, ...patch } : opening,
    ),
  };
}

export function removeSelection(floor: Floor, selection: Selection): Floor {
  if (selection.kind === "wall") {
    return {
      ...floor,
      walls: floor.walls.filter((wall) => wall.id !== selection.id),
      openings: floor.openings.filter((opening) => opening.wallId !== selection.id),
    };
  }
  if (selection.kind === "room") {
    return {
      ...floor,
      rooms: floor.rooms.filter((room) => room.id !== selection.id),
    };
  }
  if (selection.kind === "pipe") {
    return {
      ...floor,
      pipes: floor.pipes.filter((pipe) => pipe.id !== selection.id),
    };
  }
  if (selection.kind === "electrical") {
    return {
      ...floor,
      electrical: floor.electrical.filter((run) => run.id !== selection.id),
    };
  }
  return {
    ...floor,
    openings: floor.openings.filter((opening) => opening.id !== selection.id),
  };
}

export function patchWallInPlan(
  plan: FloorPlan,
  wallId: string,
  patch: Partial<Wall>,
): FloorPlan {
  return {
    ...plan,
    floors: plan.floors.map((floor) =>
      floor.walls.some((wall) => wall.id === wallId)
        ? patchWall(floor, wallId, patch)
        : floor,
    ),
  };
}

export function patchRoomInPlan(
  plan: FloorPlan,
  roomId: string,
  patch: Partial<Room>,
): FloorPlan {
  return {
    ...plan,
    floors: plan.floors.map((floor) =>
      floor.rooms.some((room) => room.id === roomId)
        ? patchRoom(floor, roomId, patch)
        : floor,
    ),
  };
}

export function patchOpeningInPlan(
  plan: FloorPlan,
  openingId: string,
  patch: Partial<Opening>,
): FloorPlan {
  return {
    ...plan,
    floors: plan.floors.map((floor) =>
      floor.openings.some((opening) => opening.id === openingId)
        ? patchOpening(floor, openingId, patch)
        : floor,
    ),
  };
}

export function patchPipeInPlan(
  plan: FloorPlan,
  pipeId: string,
  patch: Partial<PipeRun>,
): FloorPlan {
  return {
    ...plan,
    floors: plan.floors.map((floor) =>
      floor.pipes.some((pipe) => pipe.id === pipeId)
        ? {
            ...floor,
            pipes: floor.pipes.map((pipe) =>
              pipe.id === pipeId ? { ...pipe, ...patch } : pipe,
            ),
          }
        : floor,
    ),
  };
}

export function patchElectricalInPlan(
  plan: FloorPlan,
  runId: string,
  patch: Partial<ElectricalRun>,
): FloorPlan {
  return {
    ...plan,
    floors: plan.floors.map((floor) =>
      floor.electrical.some((run) => run.id === runId)
        ? {
            ...floor,
            electrical: floor.electrical.map((run) =>
              run.id === runId ? { ...run, ...patch } : run,
            ),
          }
        : floor,
    ),
  };
}

export function addWallInPlan(
  plan: FloorPlan,
  floorId: string,
  wall: Wall,
): FloorPlan {
  return updateActiveFloor(plan, floorId, (floor) => ({
    ...floor,
    walls: [...floor.walls, wall],
  }));
}

export function addRoomInPlan(
  plan: FloorPlan,
  floorId: string,
  room: Room,
): FloorPlan {
  return updateActiveFloor(plan, floorId, (floor) => ({
    ...floor,
    rooms: [...floor.rooms, room],
  }));
}

export function addOpeningInPlan(
  plan: FloorPlan,
  floorId: string,
  opening: Opening,
): FloorPlan {
  return updateActiveFloor(plan, floorId, (floor) => ({
    ...floor,
    openings: [...floor.openings, opening],
  }));
}

export function addPipeInPlan(
  plan: FloorPlan,
  floorId: string,
  pipe: PipeRun,
): FloorPlan {
  return updateActiveFloor(plan, floorId, (floor) => ({
    ...floor,
    pipes: [...floor.pipes, pipe],
  }));
}

export function addElectricalInPlan(
  plan: FloorPlan,
  floorId: string,
  run: ElectricalRun,
): FloorPlan {
  return updateActiveFloor(plan, floorId, (floor) => ({
    ...floor,
    electrical: [...floor.electrical, run],
  }));
}

export function findFloorForId(plan: FloorPlan, id: string): Floor | undefined {
  return plan.floors.find(
    (floor) =>
      floor.id === id ||
      floor.walls.some((wall) => wall.id === id) ||
      floor.rooms.some((room) => room.id === id) ||
      floor.openings.some((opening) => opening.id === id) ||
      floor.pipes.some((pipe) => pipe.id === id) ||
      floor.electrical.some((run) => run.id === id),
  );
}

export function findNamed(
  plan: FloorPlan,
  query: string,
): { floorId: string; selection: Selection } | null {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return null;
  }
  for (const floor of plan.floors) {
    const room = floor.rooms.find(
      (entry) =>
        entry.id.toLowerCase() === needle ||
        entry.name.toLowerCase().includes(needle),
    );
    if (room) {
      return { floorId: floor.id, selection: { kind: "room", id: room.id } };
    }
    const wall = floor.walls.find((entry) => entry.id.toLowerCase().includes(needle));
    if (wall) {
      return { floorId: floor.id, selection: { kind: "wall", id: wall.id } };
    }
    const pipe = floor.pipes.find(
      (entry) =>
        entry.id.toLowerCase().includes(needle) ||
        entry.name.toLowerCase().includes(needle),
    );
    if (pipe) {
      return { floorId: floor.id, selection: { kind: "pipe", id: pipe.id } };
    }
    const electrical = floor.electrical.find(
      (entry) =>
        entry.id.toLowerCase().includes(needle) ||
        entry.name.toLowerCase().includes(needle),
    );
    if (electrical) {
      return {
        floorId: floor.id,
        selection: { kind: "electrical", id: electrical.id },
      };
    }
    const opening = floor.openings.find((entry) =>
      entry.id.toLowerCase().includes(needle),
    );
    if (opening) {
      return {
        floorId: floor.id,
        selection: { kind: "opening", id: opening.id },
      };
    }
  }
  return null;
}

export function removeSelectionInPlan(
  plan: FloorPlan,
  selection: Selection,
): FloorPlan {
  return {
    ...plan,
    floors: plan.floors.map((floor) => removeSelection(floor, selection)),
  };
}

export function findInPlan(plan: FloorPlan, selection: Selection | null) {
  if (!selection) {
    return emptyFind();
  }
  for (const floor of plan.floors) {
    const found = findOnFloor(floor, selection);
    if (found.wall || found.room || found.opening || found.pipe || found.electrical) {
      return found;
    }
  }
  return emptyFind();
}

export function findOnFloor(floor: Floor, selection: Selection | null) {
  if (!selection) {
    return emptyFind();
  }
  return {
    wall:
      selection.kind === "wall"
        ? floor.walls.find((wall) => wall.id === selection.id)
        : undefined,
    room:
      selection.kind === "room"
        ? floor.rooms.find((room) => room.id === selection.id)
        : undefined,
    opening:
      selection.kind === "opening"
        ? floor.openings.find((opening) => opening.id === selection.id)
        : undefined,
    pipe:
      selection.kind === "pipe"
        ? floor.pipes.find((pipe) => pipe.id === selection.id)
        : undefined,
    electrical:
      selection.kind === "electrical"
        ? floor.electrical.find((run) => run.id === selection.id)
        : undefined,
  };
}

function emptyFind() {
  return {
    wall: undefined,
    room: undefined,
    opening: undefined,
    pipe: undefined,
    electrical: undefined,
  };
}

export function rotatePoint(
  point: Point2D,
  origin: Point2D,
  yaw: number,
): Point2D {
  const lx = point.x - origin.x;
  const lz = point.y - origin.y;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    x: origin.x + cos * lx + sin * lz,
    y: origin.y - sin * lx + cos * lz,
  };
}

export function snapMeters(value: number, step = 0.05): number {
  return Math.round(value / step) * step;
}

const EDGE_EPS = 0.05;

interface Aabb {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

type RoomEdge = { axis: "x" | "y"; side: "min" | "max" };

/**
 * Grows or shrinks a room as a real house would: push an exterior face when
 * possible, keep neighbouring rooms, and if that face is a bearing wall, move
 * the same face on every floor so the storeys stay stacked on the foundation.
 */
export function resizeRoomInPlan(
  plan: FloorPlan,
  roomId: string,
  areaSqM: number,
  options: { stack?: boolean } = {},
): FloorPlan {
  const target = Math.max(1, areaSqM);
  const source = plan.floors.find((floor) =>
    floor.rooms.some((entry) => entry.id === roomId),
  );
  const room = source?.rooms.find((entry) => entry.id === roomId);
  if (!source || !room) {
    return plan;
  }
  const box = aabbOf(room.boundary);
  const plate = aabbOf(floorPoints(source));
  const current = Math.max(0.01, (box.maxX - box.minX) * (box.maxY - box.minY));
  const edge = pickGrowEdge(box, plate, target >= current);
  const old = edgeCoord(box, edge);
  const next = snapMeters(
    old + slideDelta(edge, target - current, edgeLength(box, edge)),
  );
  if (Math.abs(next - old) < 0.001) {
    return {
      ...plan,
      floors: plan.floors.map((floor) =>
        floor.id === source.id
          ? patchRoom(floor, room.id, { areaSqM: Number(target.toFixed(2)) })
          : floor,
      ),
    };
  }
  const bearing =
    options.stack !== false &&
    nearly(old, edgeCoord(plate, edge)) &&
    roomOwnsPlateSide(box, plate, edge);
  if (bearing) {
    const delta = next - old;
    return {
      ...plan,
      floors: plan.floors.map((floor) => growStackedFacade(floor, edge, delta)),
    };
  }
  return {
    ...plan,
    floors: plan.floors.map((floor) =>
      floor.id === source.id
        ? applyRoomEdgeMove(floor, room, edge, box, plate, old, next)
        : floor,
    ),
  };
}

function growStackedFacade(floor: Floor, edge: RoomEdge, delta: number): Floor {
  const plate = aabbOf(floorPoints(floor));
  const old = edgeCoord(plate, edge);
  const next = snapMeters(old + delta);
  const facadeRoom = findRoomOnFacade(floor, edge, plate);
  if (!facadeRoom) {
    return shiftFacadeGeometry(floor, edge, old, next);
  }
  return applyRoomEdgeMove(
    floor,
    facadeRoom,
    edge,
    aabbOf(facadeRoom.boundary),
    plate,
    old,
    next,
  );
}

function findRoomOnFacade(floor: Floor, edge: RoomEdge, plate: Aabb): Room | undefined {
  const face = edgeCoord(plate, edge);
  let match: Room | undefined;
  let span = -1;
  for (const room of floor.rooms) {
    const box = aabbOf(room.boundary);
    if (!nearly(edgeCoord(box, edge), face)) {
      continue;
    }
    const length = edgeLength(box, edge);
    if (length > span) {
      match = room;
      span = length;
    }
  }
  return match;
}

function shiftFacadeGeometry(
  floor: Floor,
  edge: RoomEdge,
  old: number,
  next: number,
): Floor {
  const plate = aabbOf(floorPoints(floor));
  const shiftIf = (point: Point2D) =>
    onInfiniteEdge(point, edge, old) ? shiftPoint(point, edge, old, next) : point;
  return {
    ...floor,
    walls: floor.walls.map((wall) => ({
      ...wall,
      start: shiftIf(wall.start),
      end: shiftIf(wall.end),
    })),
    pipes: floor.pipes.map((pipe) => ({
      ...pipe,
      points: adaptRoute(pipe.points, edge, old, next, plate),
    })),
    electrical: floor.electrical.map((run) => ({
      ...run,
      points: adaptRoute(run.points, edge, old, next, plate),
    })),
  };
}

function floorPoints(floor: Floor): Point2D[] {
  return [
    ...floor.walls.flatMap((wall) => [wall.start, wall.end]),
    ...floor.rooms.flatMap((entry) => entry.boundary),
  ];
}

function aabbOf(points: Point2D[]): Aabb {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function pickGrowEdge(room: Aabb, plate: Aabb, growing: boolean): RoomEdge {
  const exterior: { edge: RoomEdge; length: number }[] = [];
  const interior: { edge: RoomEdge; length: number }[] = [];
  const consider = (edge: RoomEdge, length: number, outside: boolean) => {
    (outside ? exterior : interior).push({ edge, length });
  };
  consider({ axis: "x", side: "min" }, room.maxY - room.minY, nearly(room.minX, plate.minX));
  consider({ axis: "x", side: "max" }, room.maxY - room.minY, nearly(room.maxX, plate.maxX));
  consider({ axis: "y", side: "min" }, room.maxX - room.minX, nearly(room.minY, plate.minY));
  consider({ axis: "y", side: "max" }, room.maxX - room.minX, nearly(room.maxY, plate.maxY));
  const byLength = (left: { length: number }, right: { length: number }) =>
    right.length - left.length;
  exterior.sort(byLength);
  interior.sort(byLength);
  const preferred = growing ? [...exterior, ...interior] : [...exterior, ...interior];
  if (preferred[0]) {
    return preferred[0].edge;
  }
  return room.maxX - room.minX >= room.maxY - room.minY
    ? { axis: "y", side: "max" }
    : { axis: "x", side: "max" };
}

function nearly(left: number, right: number): boolean {
  return Math.abs(left - right) <= EDGE_EPS;
}

function applyRoomEdgeMove(
  floor: Floor,
  room: Room,
  edge: RoomEdge,
  box: Aabb,
  plate: Aabb,
  old: number,
  next: number,
): Floor {
  const ownsFacade = roomOwnsPlateSide(box, plate, edge);
  const onMovedEdge = (point: Point2D) =>
    ownsFacade
      ? onInfiniteEdge(point, edge, old)
      : onRoomEdgeSegment(point, edge, box, old);
  const shiftIf = (point: Point2D) =>
    onMovedEdge(point) ? shiftPoint(point, edge, old, next) : point;
  const exterior = nearly(edgeCoord(box, edge), edgeCoord(plate, edge));

  return {
    ...floor,
    rooms: floor.rooms.map((entry) => {
      if (entry.id === room.id) {
        return shiftRoomEdge(entry, edge, old, next, (point) =>
          onRoomEdgeSegment(point, edge, box, old),
        );
      }
      if (exterior) {
        return entry;
      }
      return shiftRoomEdge(entry, edge, old, next, (point) =>
        onRoomEdgeSegment(point, edge, box, old),
      );
    }),
    walls: floor.walls.map((wall) => ({
      ...wall,
      start: shiftIf(wall.start),
      end: shiftIf(wall.end),
    })),
    pipes: floor.pipes.map((pipe) => ({
      ...pipe,
      points: adaptRoute(pipe.points, edge, old, next, box),
    })),
    electrical: floor.electrical.map((run) => ({
      ...run,
      points: adaptRoute(run.points, edge, old, next, box),
    })),
    dimensions: floor.dimensions.map((dimension) => {
      const from = shiftIf(dimension.from);
      const to = shiftIf(dimension.to);
      if (from === dimension.from && to === dimension.to) {
        return dimension;
      }
      const span = Math.hypot(to.x - from.x, to.y - from.y);
      return { ...dimension, from, to, label: `${span.toFixed(2)} m` };
    }),
  };
}

function roomOwnsPlateSide(room: Aabb, plate: Aabb, edge: RoomEdge): boolean {
  if (edge.axis === "y") {
    return nearly(room.minX, plate.minX) && nearly(room.maxX, plate.maxX);
  }
  return nearly(room.minY, plate.minY) && nearly(room.maxY, plate.maxY);
}

function onInfiniteEdge(point: Point2D, edge: RoomEdge, old: number): boolean {
  return edge.axis === "x" ? nearly(point.x, old) : nearly(point.y, old);
}

function onRoomEdgeSegment(
  point: Point2D,
  edge: RoomEdge,
  box: Aabb,
  old: number,
): boolean {
  if (!onInfiniteEdge(point, edge, old)) {
    return false;
  }
  if (edge.axis === "y") {
    return point.x >= box.minX - EDGE_EPS && point.x <= box.maxX + EDGE_EPS;
  }
  return point.y >= box.minY - EDGE_EPS && point.y <= box.maxY + EDGE_EPS;
}

function edgeCoord(box: Aabb, edge: RoomEdge): number {
  if (edge.axis === "x") {
    return edge.side === "min" ? box.minX : box.maxX;
  }
  return edge.side === "min" ? box.minY : box.maxY;
}

function edgeLength(box: Aabb, edge: RoomEdge): number {
  return edge.axis === "x" ? box.maxY - box.minY : box.maxX - box.minX;
}

function slideDelta(edge: RoomEdge, deltaArea: number, length: number): number {
  const travel = deltaArea / Math.max(length, 0.01);
  return edge.side === "min" ? -travel : travel;
}

function shiftRoomEdge(
  room: Room,
  edge: RoomEdge,
  old: number,
  next: number,
  take: (point: Point2D) => boolean,
): Room {
  const boundary = room.boundary.map((point) =>
    take(point) ? shiftPoint(point, edge, old, next) : point,
  );
  if (boundary.every((point, index) => point === room.boundary[index])) {
    return room;
  }
  const box = aabbOf(boundary);
  const center = polygonCentroid(boundary);
  return {
    ...room,
    boundary,
    labelPosition: center,
    areaSqM: Number(((box.maxX - box.minX) * (box.maxY - box.minY)).toFixed(2)),
  };
}

/**
 * Stretch MEP that already sits in the moved room, and if the plate grew,
 * extend the run toward the new facade so lights and laterals don't die
 * in the old volume.
 */
function adaptRoute<T extends Point2D>(
  points: T[],
  edge: RoomEdge,
  old: number,
  next: number,
  region: Aabb,
): T[] {
  const mapped = points.map((point) => remapMepPoint(point, edge, old, next, region));
  if (Math.abs(next - old) < 0.2) {
    return mapped;
  }
  const growing = edge.side === "max" ? next > old : next < old;
  if (!growing) {
    return mapped;
  }
  const served = mapped.filter((point) => inRoomBand(point, edge, region, old, next));
  if (served.length === 0) {
    return mapped;
  }
  const along = (point: Point2D) => (edge.axis === "x" ? point.x : point.y);
  const outermost = served.reduce((best, point) =>
    Math.abs(along(point) - next) < Math.abs(along(best) - next) ? point : best,
  );
  if (Math.abs(along(outermost) - next) < 1.2) {
    return mapped;
  }
  const inset = next + (edge.side === "max" ? -0.8 : 0.8);
  const extra = (
    edge.axis === "x"
      ? { ...outermost, x: inset }
      : { ...outermost, y: inset }
  ) as T;
  return [...mapped, extra];
}

function remapMepPoint<T extends Point2D>(
  point: T,
  edge: RoomEdge,
  old: number,
  next: number,
  region: Aabb,
): T {
  if (!inCrossSpan(point, edge, region)) {
    return point;
  }
  const along = edge.axis === "x" ? point.x : point.y;
  const anchor = oppositeCoord(region, edge);
  const lo = Math.min(anchor, old);
  const hi = Math.max(anchor, old);
  if (along < lo - EDGE_EPS || along > hi + EDGE_EPS) {
    return point;
  }
  const span = old - anchor;
  if (Math.abs(span) < 0.001) {
    const moved = shiftPoint(point, edge, old, next);
    return moved === point ? point : { ...point, ...moved };
  }
  const mapped = anchor + ((along - anchor) / span) * (next - anchor);
  return edge.axis === "x" ? { ...point, x: mapped } : { ...point, y: mapped };
}

function inRoomBand(
  point: Point2D,
  edge: RoomEdge,
  region: Aabb,
  old: number,
  next: number,
): boolean {
  if (!inCrossSpan(point, edge, region)) {
    return false;
  }
  const along = edge.axis === "x" ? point.x : point.y;
  const lo = Math.min(oppositeCoord(region, edge), old, next);
  const hi = Math.max(oppositeCoord(region, edge), old, next);
  return along >= lo - EDGE_EPS && along <= hi + EDGE_EPS;
}

function inCrossSpan(point: Point2D, edge: RoomEdge, region: Aabb): boolean {
  if (edge.axis === "y") {
    return point.x >= region.minX - EDGE_EPS && point.x <= region.maxX + EDGE_EPS;
  }
  return point.y >= region.minY - EDGE_EPS && point.y <= region.maxY + EDGE_EPS;
}

function oppositeCoord(box: Aabb, edge: RoomEdge): number {
  if (edge.axis === "x") {
    return edge.side === "min" ? box.maxX : box.minX;
  }
  return edge.side === "min" ? box.maxY : box.minY;
}

function shiftPoint(point: Point2D, edge: RoomEdge, old: number, next: number): Point2D {
  if (edge.axis === "x" && Math.abs(point.x - old) <= EDGE_EPS) {
    return { ...point, x: next };
  }
  if (edge.axis === "y" && Math.abs(point.y - old) <= EDGE_EPS) {
    return { ...point, y: next };
  }
  return point;
}

export function polygonCentroid(points: Point2D[]): Point2D {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
}
