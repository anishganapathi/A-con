import type { FloorPlan } from "../types/floorPlan";

export function summarizePlan(plan: FloorPlan): string {
  const floors = plan.floors.map((floor) => {
    const rooms = floor.rooms.map((room) => room.name).join(", ");
    return `${floor.name} (${floor.id}, z=${floor.elevation}m): ${floor.walls.length} walls, ${floor.rooms.length} rooms [${rooms}], ${floor.pipes.length} pipes, ${floor.electrical.length} electrical`;
  });
  return [
    `${plan.name} · ${plan.source.sheet} · ${plan.source.title}`,
    plan.source.notes,
    `Roof ${plan.roof.type} eave ${plan.roof.eaveHeight}m / ridge ${plan.roof.ridgeHeight}m`,
    ...floors,
  ].join("\n");
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
