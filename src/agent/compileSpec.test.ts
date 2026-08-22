import { describe, expect, test } from "vitest";
import type { Floor, Point2D } from "../types/floorPlan";
import type { BuildingSpec, MassingVolume } from "./buildingSpec";
import { compileSpec } from "./compileSpec";

const footprint: Point2D[] = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 30 },
  { x: 0, y: 30 },
];

/** Mirrors a surveyed tower whose recorded tip rises well above its roof. */
function towerSpec(overrides: Partial<BuildingSpec> = {}): Partial<BuildingSpec> {
  return {
    name: "Tip Tower",
    typology: "office",
    footprint,
    stories: 60,
    storyHeight: 4,
    roof: "flat",
    includeMep: true,
    grossFloorAreaM2: 40 * 30 * 60 * 0.8,
    tipHeight: 300,
    ...overrides,
  };
}

function box(minX: number, minY: number, maxX: number, maxY: number): Point2D[] {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

const massing: MassingVolume[] = [
  {
    id: "base",
    polygon: box(0, 0, 40, 30),
    minHeight: 0,
    maxHeight: 100,
    roofShape: "flat",
    roofHeight: 0,
  },
  {
    id: "mast",
    polygon: box(16, 11, 24, 19),
    minHeight: 100,
    maxHeight: 160,
    roofShape: "flat",
    roofHeight: 0,
  },
];

function extent(floor: Floor): { width: number; depth: number; cx: number; cy: number } {
  const xs = floor.walls.flatMap((wall) => [wall.start.x, wall.end.x]);
  const ys = floor.walls.flatMap((wall) => [wall.start.y, wall.end.y]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    width: maxX - minX,
    depth: maxY - minY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  };
}

function topOfStructure(floors: Floor[]): number {
  return Math.max(
    ...floors.map(
      (floor) => floor.elevation + Math.max(...floor.walls.map((wall) => wall.height)),
    ),
  );
}

describe("compileSpec spire", () => {
  test("carries structure up to the surveyed tip", () => {
    const plan = compileSpec(towerSpec());

    expect(topOfStructure(plan.floors)).toBeCloseTo(300, 0);
  });

  test("tops the ridge datum out at the tip", () => {
    const plan = compileSpec(towerSpec());

    expect(plan.roof.ridgeHeight).toBeGreaterThanOrEqual(300);
  });

  test("draws the spire far slimmer than the roof plate", () => {
    const plan = compileSpec(towerSpec());
    const spire = plan.floors.filter((floor) => floor.occupiable === false);
    const roofPlate = plan.floors.filter((floor) => floor.occupiable !== false).at(-1)!;

    expect(spire.length).toBeGreaterThan(0);
    expect(extent(spire[0]).width).toBeLessThan(extent(roofPlate).width * 0.3);
  });

  test("tapers the spire towards the tip", () => {
    const plan = compileSpec(towerSpec());
    const spire = plan.floors.filter((floor) => floor.occupiable === false);
    const widths = spire.map((floor) => extent(floor).width);

    expect(widths.at(-1)!).toBeLessThan(widths[0]);
    for (let i = 1; i < widths.length; i += 1) {
      expect(widths[i]).toBeLessThanOrEqual(widths[i - 1] + 0.001);
    }
  });

  test("stands the spire over the centre of the top plate", () => {
    const plan = compileSpec(towerSpec());
    const spire = plan.floors.filter((floor) => floor.occupiable === false);
    const roofPlate = plan.floors.filter((floor) => floor.occupiable !== false).at(-1)!;
    const centre = extent(roofPlate);

    for (const floor of spire) {
      expect(extent(floor).cx).toBeCloseTo(centre.cx, 0);
      expect(extent(floor).cy).toBeCloseTo(centre.cy, 0);
    }
  });

  test("runs no plumbing, wiring, or rooms up the spire", () => {
    const plan = compileSpec(towerSpec());
    const spire = plan.floors.filter((floor) => floor.occupiable === false);

    expect(spire.length).toBeGreaterThan(0);
    for (const floor of spire) {
      expect(floor.pipes).toHaveLength(0);
      expect(floor.electrical).toHaveLength(0);
      expect(floor.rooms).toHaveLength(0);
    }
  });

  test("builds the mast from a bounded number of segments", () => {
    const plan = compileSpec(towerSpec({ tipHeight: 600 }));
    const spire = plan.floors.filter((floor) => floor.occupiable === false);

    expect(spire.length).toBeLessThanOrEqual(24);
    expect(topOfStructure(plan.floors)).toBeCloseTo(600, 0);
  });

  test("leaves a building with no recorded spire alone", () => {
    const plan = compileSpec(towerSpec({ tipHeight: undefined }));

    expect(plan.floors.every((floor) => floor.occupiable !== false)).toBe(true);
    expect(topOfStructure(plan.floors)).toBeCloseTo(240, 0);
  });

  test("keeps surveyed mast levels free of plumbing, wiring, and rooms", () => {
    const plan = compileSpec(
      towerSpec({ massing, stories: 25, storyHeight: 4, tipHeight: 160 }),
    );
    const above = plan.floors.filter((floor) => floor.elevation >= 100);

    expect(above.length).toBeGreaterThan(0);
    for (const floor of above) {
      expect(floor.pipes).toHaveLength(0);
      expect(floor.electrical).toHaveLength(0);
      expect(floor.rooms).toHaveLength(0);
    }
  });
});
