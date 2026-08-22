import { describe, expect, test } from "vitest";
import { mockFloorPlan } from "../data/mockFloorPlan";
import { blendPlans, easeOutCubic, lerp, sameTopology } from "./blendPlan";

describe("blendPlans", () => {
  test("eases a ridge raise between the two heights", () => {
    const raised = {
      ...mockFloorPlan,
      roof: { ...mockFloorPlan.roof, ridgeHeight: 9 },
    };

    const mid = blendPlans(mockFloorPlan, raised, 0.5);
    const start = mockFloorPlan.roof.ridgeHeight;

    // The stock house already sits above 9 m, so a "raise to 9" in the demo
    // is actually a drop from this fixture. The tween still has to travel.
    expect(mid.roof.ridgeHeight).not.toBe(start);
    expect(mid.roof.ridgeHeight).not.toBe(9);
    expect(mid.roof.ridgeHeight).toBeCloseTo(lerp(start, 9, easeOutCubic(0.5)), 5);
  });

  test("slides an opening along its wall", () => {
    const floor = mockFloorPlan.floors[0];
    const opening = floor.openings[0];
    const moved = {
      ...mockFloorPlan,
      floors: mockFloorPlan.floors.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              openings: entry.openings.map((item) =>
                item.id === opening.id
                  ? { ...item, offsetFromStart: item.offsetFromStart + 1 }
                  : item,
              ),
            }
          : entry,
      ),
    };

    const mid = blendPlans(mockFloorPlan, moved, 0.5);
    const shown = mid.floors[0].openings.find((item) => item.id === opening.id);

    expect(shown?.offsetFromStart).toBeGreaterThan(opening.offsetFromStart);
    expect(shown?.offsetFromStart).toBeLessThan(opening.offsetFromStart + 1);
  });

  test("snaps when the floor list is a different building", () => {
    const rebuilt = {
      ...mockFloorPlan,
      floors: mockFloorPlan.floors.slice(0, 1).map((floor) => ({
        ...floor,
        id: "brand-new-ground",
      })),
    };

    expect(sameTopology(mockFloorPlan, rebuilt)).toBe(false);
    expect(blendPlans(mockFloorPlan, rebuilt, 0.4)).toBe(rebuilt);
  });

  test("returns the target at the end of the tween", () => {
    const raised = {
      ...mockFloorPlan,
      roof: { ...mockFloorPlan.roof, ridgeHeight: 9 },
    };

    expect(blendPlans(mockFloorPlan, raised, 1)).toBe(raised);
  });
});
