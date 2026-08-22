import {
  DEFAULT_ROOF_MATERIAL,
  defaultOpeningMaterial,
  defaultRoomMaterial,
  defaultWallMaterial,
  resolveMaterial,
} from "../editor/materials";
import type { FloorPlan, SurfaceMaterial } from "../types/floorPlan";
import { matchPreset, type MaterialPreset, type PresetSurface } from "./presets";

/**
 * Applies a finish to every surface it belongs on, across all storeys. Picking
 * "red brick" is a decision about the building, not about the one wall that
 * happened to be clicked, so it lands everywhere at once.
 */
export function applyPresetToPlan(plan: FloorPlan, preset: MaterialPreset): FloorPlan {
  const material = { ...preset.material };

  if (preset.surface === "roof") {
    return { ...plan, roof: { ...plan.roof, material } };
  }

  return {
    ...plan,
    floors: plan.floors.map((floor) => ({
      ...floor,
      walls: floor.walls.map((wall) => {
        const isEnvelope = wall.type === "exterior";
        const wanted = preset.surface === "facade" ? isEnvelope : !isEnvelope;
        return wanted && (preset.surface === "facade" || preset.surface === "interior")
          ? { ...wall, material }
          : wall;
      }),
      openings: floor.openings.map((opening) =>
        // Doors keep their own colour: a door is joinery, not glazing.
        preset.surface === "glazing" && opening.type === "window"
          ? { ...opening, material }
          : opening,
      ),
      rooms: floor.rooms.map((room) =>
        preset.surface === "floor" ? { ...room, material } : room,
      ),
    })),
  };
}

/**
 * The finish a surface is wearing, read through to the default it renders with
 * so an untouched building still shows the right swatch as selected. Null once
 * the colour has been tuned away from any preset.
 */
export function currentFinish(
  plan: FloorPlan,
  surface: PresetSurface,
): MaterialPreset | null {
  const material = representativeMaterial(plan, surface);
  return material ? matchPreset(material, surface) : null;
}

function representativeMaterial(
  plan: FloorPlan,
  surface: PresetSurface,
): SurfaceMaterial | null {
  if (surface === "roof") {
    return resolveMaterial(plan.roof.material, DEFAULT_ROOF_MATERIAL);
  }
  for (const floor of plan.floors) {
    if (surface === "facade" || surface === "interior") {
      const wall = floor.walls.find((entry) =>
        surface === "facade" ? entry.type === "exterior" : entry.type !== "exterior",
      );
      if (wall) {
        return resolveMaterial(wall.material, defaultWallMaterial(wall));
      }
    }
    if (surface === "glazing") {
      const window = floor.openings.find((entry) => entry.type === "window");
      if (window) {
        return resolveMaterial(window.material, defaultOpeningMaterial(window));
      }
    }
    if (surface === "floor") {
      const [room] = floor.rooms;
      if (room) {
        return resolveMaterial(room.material, defaultRoomMaterial(room));
      }
    }
  }
  return null;
}
