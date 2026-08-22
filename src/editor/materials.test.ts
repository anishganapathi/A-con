import { describe, expect, test } from "vitest";
import { mockFloorPlan } from "../data/mockFloorPlan";
import type { Wall } from "../types/floorPlan";
import { defaultWallMaterial, isStockMaterial } from "./materials";

const exteriorWall = (): Wall => {
  const wall = mockFloorPlan.floors
    .flatMap((floor) => floor.walls)
    .find((entry) => entry.type === "exterior");
  if (!wall) {
    throw new Error("the mock plan has no exterior wall");
  }
  return wall;
};

describe("isStockMaterial", () => {
  test("counts a missing material as stock", () => {
    const wall = exteriorWall();

    expect(isStockMaterial(undefined, defaultWallMaterial(wall))).toBe(true);
  });

  // The mock plan spells out the stock colour on every exterior wall, which is
  // why "has a material" cannot stand in for "someone chose a finish".
  test("sees through a material that merely restates the default", () => {
    const wall = exteriorWall();

    expect(wall.material).toBeDefined();
    expect(isStockMaterial(wall.material, defaultWallMaterial(wall))).toBe(true);
  });

  test("reports a chosen finish", () => {
    const wall = exteriorWall();
    const brick = { color: "#9c4a35", roughness: 0.88, metalness: 0.02, opacity: 1 };

    expect(isStockMaterial(brick, defaultWallMaterial(wall))).toBe(false);
  });

  test("ignores hex casing", () => {
    const wall = exteriorWall();
    const stock = defaultWallMaterial(wall);

    expect(
      isStockMaterial({ ...stock, color: stock.color.toUpperCase() }, stock),
    ).toBe(true);
  });
});
