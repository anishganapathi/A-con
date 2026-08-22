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
