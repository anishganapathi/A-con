import { describe, expect, test } from "vitest";
import { applyAgentAction } from "./applyAction";
import { mockFloorPlan } from "../data/mockFloorPlan";
import { applyElevationMatch, facadeChanged } from "./matchElevation";

describe("matchElevation", () => {
  test("steepens the gable when the brief copies the live roof", () => {
    const actions = applyElevationMatch(mockFloorPlan, {
      eaveHeight: mockFloorPlan.roof.eaveHeight,
      ridgeHeight: mockFloorPlan.roof.ridgeHeight,
    });
    const roof = actions.find((action) => action.type === "patch_roof");
    expect(roof?.type === "patch_roof" && roof.patch.ridgeHeight).toBeGreaterThan(
      mockFloorPlan.roof.ridgeHeight + 1,
    );
  });

  test("moves the front windows so the elevation actually changes", () => {
    const actions = applyElevationMatch(mockFloorPlan, {
      windowWidth: 1.0,
      windowHeight: 1.6,
      windowsPerFloor: 3,
    });
    expect(facadeChanged(mockFloorPlan, actions)).toBe(true);
    const after = actions.reduce(applyAgentAction, mockFloorPlan);
    const south = after.floors[0].openings.filter((opening) => opening.wallId === "ext-south");
    expect(south.some((opening) => opening.type === "door")).toBe(true);
    expect(south.filter((opening) => opening.type === "window").length).toBeGreaterThanOrEqual(2);
  });
});
