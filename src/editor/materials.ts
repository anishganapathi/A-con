import type {
  ElectricalRun,
  Opening,
  PipeRun,
  Room,
  SurfaceMaterial,
  Wall,
} from "../types/floorPlan";

export const DEFAULT_ROOF_MATERIAL: SurfaceMaterial = {
  color: "#5b6570",
  roughness: 0.38,
  metalness: 0.62,
  opacity: 1,
};

export const WALL_TYPE_COLORS: Record<Wall["type"], string> = {
  exterior: "#d7cec0",
  interior: "#f0ebe3",
  partition: "#f4f0e9",
};

const ROOM_TONES = [
  "#cbb48a",
  "#c4b092",
  "#d0c4a8",
  "#c9b286",
  "#d5cbb8",
  "#c8b89a",
] as const;

export function defaultWallMaterial(wall: Wall): SurfaceMaterial {
  if (wall.type === "exterior") {
    return {
      color: WALL_TYPE_COLORS.exterior,
      roughness: 0.92,
      metalness: 0.02,
      opacity: 1,
    };
  }
  return {
    color: WALL_TYPE_COLORS[wall.type],
    roughness: 0.82,
    metalness: 0.02,
    opacity: 1,
  };
}

export function defaultRoomMaterial(room: Room): SurfaceMaterial {
  let hash = 0;
  for (let i = 0; i < room.id.length; i += 1) {
    hash = (hash + room.id.charCodeAt(i) * (i + 1)) % ROOM_TONES.length;
  }
  return {
    color: ROOM_TONES[hash] ?? ROOM_TONES[0],
    roughness: 0.9,
    metalness: 0,
    opacity: 1,
  };
}

export function defaultPipeMaterial(pipe: PipeRun): SurfaceMaterial {
  const colors: Record<PipeRun["system"], string> = {
    supply: "#b87333",
    waste: "#5a5348",
    vent: "#9aa0a6",
    gas: "#d4a017",
  };
  return {
    color: colors[pipe.system],
    roughness: 0.35,
    metalness: 0.65,
    opacity: 1,
  };
}

export function defaultElectricalMaterial(run: ElectricalRun): SurfaceMaterial {
  const colors: Record<ElectricalRun["circuit"], string> = {
    power: "#e39b1a",
    lighting: "#f0c94d",
    data: "#3d7ea6",
  };
  return {
    color: colors[run.circuit],
    roughness: 0.45,
    metalness: 0.25,
    opacity: 1,
  };
}

export function defaultOpeningMaterial(opening: Opening): SurfaceMaterial {
  const isWindow = opening.type === "window";
  return {
    color: isWindow ? "#9ecfe4" : "#6a5344",
    roughness: isWindow ? 0.08 : 0.65,
    metalness: isWindow ? 0.15 : 0.05,
    opacity: isWindow ? 0.32 : 0.88,
  };
}

export function resolveMaterial(
  stored: SurfaceMaterial | undefined,
  fallback: SurfaceMaterial,
): SurfaceMaterial {
  if (!stored) {
    return fallback;
  }
  return {
    color: stored.color,
    roughness: stored.roughness,
    metalness: stored.metalness,
    opacity: stored.opacity ?? fallback.opacity ?? 1,
  };
}
