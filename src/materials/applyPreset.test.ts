import { describe, expect, test } from "vitest";
import { mockFloorPlan } from "../data/mockFloorPlan";
import type { FloorPlan } from "../types/floorPlan";
import { applyPresetToPlan, currentFinish } from "./applyPreset";
import { presetsForSurface, type PresetSurface } from "./presets";

function plan(): FloorPlan {
  return structuredClone(mockFloorPlan);
}

const facade = presetsForSurface("facade")[1];
const glazing = presetsForSurface("glazing")[0];
const roof = presetsForSurface("roof")[0];
const interior = presetsForSurface("interior")[0];
const floor = presetsForSurface("floor")[0];

const walls = (subject: FloorPlan) => subject.floors.flatMap((entry) => entry.walls);
const openings = (subject: FloorPlan) => subject.floors.flatMap((entry) => entry.openings);
const rooms = (subject: FloorPlan) => subject.floors.flatMap((entry) => entry.rooms);

describe("applyPresetToPlan", () => {
  test("dresses every exterior wall in a facade finish", () => {
    const next = applyPresetToPlan(plan(), facade);
    const exterior = walls(next).filter((wall) => wall.type === "exterior");

    expect(exterior.length).toBeGreaterThan(0);
    for (const wall of exterior) {
      expect(wall.material).toEqual(facade.material);
    }
  });

  test("leaves the inside alone when the facade changes", () => {
    const before = plan();
    const next = applyPresetToPlan(before, facade);
    const inside = walls(next).filter((wall) => wall.type !== "exterior");

    expect(inside.length).toBeGreaterThan(0);
    for (const [index, wall] of inside.entries()) {
      expect(wall.material).toEqual(
        walls(before).filter((entry) => entry.type !== "exterior")[index].material,
      );
    }
  });

  test("an interior finish covers partitions too, but not the envelope", () => {
    const next = applyPresetToPlan(plan(), interior);

    for (const wall of walls(next)) {
      if (wall.type === "exterior") {
        expect(wall.material).not.toEqual(interior.material);
      } else {
        expect(wall.material).toEqual(interior.material);
      }
    }
  });

  test("glazing goes into the windows and not the doors", () => {
    const next = applyPresetToPlan(plan(), glazing);
    const windows = openings(next).filter((opening) => opening.type === "window");
    const doors = openings(next).filter((opening) => opening.type === "door");

    expect(windows.length).toBeGreaterThan(0);
    for (const window of windows) {
      expect(window.material).toEqual(glazing.material);
    }
    for (const door of doors) {
      expect(door.material).not.toEqual(glazing.material);
    }
  });

  test("a roof finish lands on the roof", () => {
    expect(applyPresetToPlan(plan(), roof).roof.material).toEqual(roof.material);
  });

  test("a floor finish lands on the rooms", () => {
    const next = applyPresetToPlan(plan(), floor);

    expect(rooms(next).length).toBeGreaterThan(0);
    for (const room of rooms(next)) {
      expect(room.material).toEqual(floor.material);
    }
  });

  test("reaches every storey, not just the one on screen", () => {
    const source = plan();
    expect(source.floors.length).toBeGreaterThan(1);
    const next = applyPresetToPlan(source, facade);

    for (const level of next.floors) {
      for (const wall of level.walls.filter((entry) => entry.type === "exterior")) {
        expect(wall.material).toEqual(facade.material);
      }
    }
  });

  test("keeps geometry untouched", () => {
    const before = plan();
    const next = applyPresetToPlan(before, facade);
    const [first] = walls(next);
    const [original] = walls(before);

    expect(first.start).toEqual(original.start);
    expect(first.end).toEqual(original.end);
    expect(first.height).toBe(original.height);
    expect(first.thickness).toBe(original.thickness);
  });

  test("does not mutate the plan it was handed", () => {
    const before = plan();
    applyPresetToPlan(before, facade);

    for (const wall of walls(before).filter((entry) => entry.type === "exterior")) {
      expect(wall.material).not.toEqual(facade.material);
    }
  });

  test("is repeatable: a second finish replaces the first", () => {
    const other = presetsForSurface("facade")[3];
    const next = applyPresetToPlan(applyPresetToPlan(plan(), facade), other);

    for (const wall of walls(next).filter((entry) => entry.type === "exterior")) {
      expect(wall.material).toEqual(other.material);
    }
  });
});

describe("currentFinish", () => {
  const surfaces: PresetSurface[] = ["facade", "glazing", "roof", "interior", "floor"];

  test.each(surfaces)("reports back the %s finish that was applied", (surface) => {
    const preset = presetsForSurface(surface)[1];
    const next = applyPresetToPlan(plan(), preset);

    expect(currentFinish(next, surface)?.id).toBe(preset.id);
  });

  test("reports nothing once a colour has been mixed by hand", () => {
    const custom = plan();
    for (const floor of custom.floors) {
      for (const wall of floor.walls) {
        wall.material = { color: "#ff00ff", roughness: 0.5, metalness: 0.5 };
      }
    }

    expect(currentFinish(custom, "facade")).toBeNull();
  });

  // The roof falls back to standing seam metal, which is a preset, so an
  // untouched plan should still show that swatch as the one in use.
  test("reads through to the default a surface renders with", () => {
    const fresh = plan();
    delete fresh.roof.material;

    expect(currentFinish(fresh, "roof")?.id).toBe("roof-standing-seam");
  });

  test("does not confuse one surface's finish for another's", () => {
    const next = applyPresetToPlan(plan(), presetsForSurface("facade")[1]);

    expect(currentFinish(next, "interior")?.id).not.toBe(presetsForSurface("facade")[1].id);
  });

  test("survives a plan with no floors", () => {
    expect(currentFinish({ ...plan(), floors: [] }, "facade")).toBeNull();
  });
});
