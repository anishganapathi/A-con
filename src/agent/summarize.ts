import type { FloorPlan } from "../types/floorPlan";

export function summarizePlan(plan: FloorPlan): string {
  const floors = plan.floors.map((floor) => {
    const rooms = floor.rooms
      .map((room) => `${room.id} “${room.name}” ${room.areaSqM ?? "?"}m²`)
      .join(", ");
    const walls = floor.walls
      .map((wall) => {
        const length = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
        return `${wall.id} len=${round(length)}m h=${wall.height}`;
      })
      .join(", ");
    // The host wall and offset are what let the model re-space an opening
    // instead of guessing a position that lands off the end of the wall.
    const openings = (floor.openings ?? [])
      .map(
        (opening) =>
          `${opening.id} ${opening.type} on ${opening.wallId} @${round(opening.offsetFromStart)}m ${opening.width}×${opening.height}`,
      )
      .join(", ");
    // Without these the model has no run to name, so it answers "patch the
    // electrical" with no id and the edit lands nowhere.
    const pipes = (floor.pipes ?? [])
      .map((pipe) => `${pipe.id} “${pipe.name}” ${pipe.system}`)
      .join(", ");
    const electrical = (floor.electrical ?? [])
      .map((run) => `${run.id} “${run.name}” ${run.circuit}`)
      .join(", ");
    return `${floor.name} (${floor.id}, z=${floor.elevation}m): rooms [${rooms}]; walls [${walls}]; openings [${openings}]; pipes [${pipes}]; electrical [${electrical}]`;
  });
  return [
    `${plan.name} · ${plan.source.sheet} · ${plan.source.title}`,
    plan.source.notes,
    `Roof ${plan.roof.type} eave ${plan.roof.eaveHeight}m / ridge ${plan.roof.ridgeHeight}m`,
    ...floors,
  ].join("\n");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function planCatalog(plan: FloorPlan) {
  return plan.floors.flatMap((floor) => [
    ...floor.rooms.map((room) => ({
      floorId: floor.id,
      kind: "room" as const,
      id: room.id,
      name: room.name,
    })),
    ...floor.walls.map((wall) => ({
      floorId: floor.id,
      kind: "wall" as const,
      id: wall.id,
      name: wall.id,
    })),
    ...floor.pipes.map((pipe) => ({
      floorId: floor.id,
      kind: "pipe" as const,
      id: pipe.id,
      name: pipe.name,
    })),
    ...floor.electrical.map((run) => ({
      floorId: floor.id,
      kind: "electrical" as const,
      id: run.id,
      name: run.name,
    })),
  ]);
}
