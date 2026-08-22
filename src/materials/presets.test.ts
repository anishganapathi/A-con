import { describe, expect, test } from "vitest";
import {
  MATERIAL_PRESETS,
  matchPreset,
  presetsForSurface,
  surfaceForSelection,
  swatchStyle,
  type PresetSurface,
} from "./presets";

const SURFACES: PresetSurface[] = ["facade", "glazing", "roof", "interior", "floor"];

describe("the preset library", () => {
  test("gives every preset a unique id", () => {
    const ids = MATERIAL_PRESETS.map((preset) => preset.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  test("names every preset", () => {
    for (const preset of MATERIAL_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(2);
      expect(preset.note.length).toBeGreaterThan(4);
    }
  });

  test("uses valid hex colours throughout", () => {
    for (const preset of MATERIAL_PRESETS) {
      expect(preset.material.color).toMatch(/^#[0-9a-f]{6}$/i);
      for (const color of preset.swatch) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  test("gives each swatch at least two tones to read as a material", () => {
    for (const preset of MATERIAL_PRESETS) {
      expect(preset.swatch.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("keeps every PBR value in range", () => {
    for (const preset of MATERIAL_PRESETS) {
      const { roughness, metalness, opacity } = preset.material;
      expect(roughness).toBeGreaterThanOrEqual(0);
      expect(roughness).toBeLessThanOrEqual(1);
      expect(metalness).toBeGreaterThanOrEqual(0);
      expect(metalness).toBeLessThanOrEqual(1);
      if (opacity !== undefined) {
        expect(opacity).toBeGreaterThan(0);
        expect(opacity).toBeLessThanOrEqual(1);
      }
    }
  });

  test("makes anything glassy see-through", () => {
    for (const preset of MATERIAL_PRESETS.filter((entry) => entry.pattern === "glass")) {
      expect(preset.material.opacity).toBeLessThan(1);
    }
  });

  test("offers a real choice on every surface", () => {
    for (const surface of SURFACES) {
      expect(presetsForSurface(surface).length).toBeGreaterThanOrEqual(4);
    }
  });

  test("keeps each surface's list to that surface", () => {
    for (const surface of SURFACES) {
      for (const preset of presetsForSurface(surface)) {
        expect(preset.surface).toBe(surface);
      }
    }
  });
});

describe("surfaceForSelection", () => {
  test("sends an exterior wall to the facade finishes", () => {
    expect(surfaceForSelection("wall", "exterior")).toBe("facade");
  });

  test.each(["interior", "partition"] as const)("sends a %s wall indoors", (type) => {
    expect(surfaceForSelection("wall", type)).toBe("interior");
  });

  test("sends an opening to the glazing finishes", () => {
    expect(surfaceForSelection("opening")).toBe("glazing");
  });

  test("sends a room to the floor finishes", () => {
    expect(surfaceForSelection("room")).toBe("floor");
  });

  // Pipe and conduit colours are a system code, not a finish, so there is
  // nothing to offer and the picker stays hidden.
  test.each(["pipe", "electrical"] as const)("offers nothing for %s", (kind) => {
    expect(surfaceForSelection(kind)).toBeNull();
  });
});

describe("matchPreset", () => {
  test("recognises a preset's own material", () => {
    const preset = presetsForSurface("facade")[2];

    expect(matchPreset(preset.material, "facade")?.id).toBe(preset.id);
  });

  test("ignores hex casing", () => {
    const preset = presetsForSurface("roof")[0];
    const shouting = { ...preset.material, color: preset.material.color.toUpperCase() };

    expect(matchPreset(shouting, "roof")?.id).toBe(preset.id);
  });

  test("returns nothing for a hand-picked colour", () => {
    expect(matchPreset({ color: "#ff00ff", roughness: 0.5, metalness: 0.5 }, "facade")).toBeNull();
  });

  test("does not match a preset from another surface", () => {
    const roof = presetsForSurface("roof")[0];

    expect(matchPreset(roof.material, "facade")).toBeNull();
  });

  test("tolerates the rounding a slider introduces", () => {
    const preset = presetsForSurface("facade")[0];
    const nudged = {
      ...preset.material,
      roughness: preset.material.roughness + 0.004,
    };

    expect(matchPreset(nudged, "facade")?.id).toBe(preset.id);
  });

  test("rejects a material that drifted well off the preset", () => {
    const preset = presetsForSurface("facade")[0];
    const drifted = { ...preset.material, roughness: 0.2 };

    expect(matchPreset(drifted, "facade")).toBeNull();
  });
});

describe("swatchStyle", () => {
  test("paints with every tone the preset declares", () => {
    for (const preset of MATERIAL_PRESETS) {
      const background = swatchStyle(preset).background;
      for (const color of preset.swatch) {
        expect(background).toContain(color);
      }
    }
  });

  test("draws courses as bands so brick does not look like paint", () => {
    const brick = MATERIAL_PRESETS.find((preset) => preset.pattern === "courses")!;

    expect(swatchStyle(brick).background).toContain("repeating-linear-gradient");
  });

  test("gives a speckled finish scattered highlights", () => {
    const speckled = MATERIAL_PRESETS.find((preset) => preset.pattern === "speckle")!;

    expect(swatchStyle(speckled).background).toContain("radial-gradient");
  });

  test("tells two patterns apart", () => {
    const courses = MATERIAL_PRESETS.find((preset) => preset.pattern === "courses")!;
    const flat = MATERIAL_PRESETS.find((preset) => preset.pattern === "flat")!;

    expect(swatchStyle(courses).background).not.toBe(swatchStyle(flat).background);
  });
});
