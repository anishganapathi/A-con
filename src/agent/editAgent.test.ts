import { describe, expect, test } from "vitest";
import { mockFloorPlan } from "../data/mockFloorPlan";
import { applyAgentAction } from "./applyAction";
import { planEdits } from "./editAgent";

describe("roof edits", () => {
  test("maps remove the roof to a live patch, not a rebuild", () => {
    expect(planEdits("remove the roof", mockFloorPlan)).toEqual([
      { type: "patch_roof", patch: { visible: false } },
    ]);
  });

  test("can put the roof back", () => {
    expect(planEdits("show the roof", mockFloorPlan)).toEqual([
      { type: "patch_roof", patch: { visible: true } },
    ]);
  });
  

  test("maps an L3 living-room size change to a live resize", () => {
    expect(planEdits("increase the l3 living room size to 38 m", mockFloorPlan)).toEqual([
      { type: "resize_room", roomId: "l3-living", areaSqM: 38 },
    ]);
  });

  test("keeps kitchen space when a living room grows a little", () => {
    const next = applyAgentAction(mockFloorPlan, {
      type: "resize_room",
      roomId: "l3-living",
      areaSqM: 38,
    });
    const l3 = next.floors.find((floor) => floor.id === "l3");
    const living = l3?.rooms.find((room) => room.id === "l3-living");
    const kitchen = l3?.rooms.find((room) => room.id === "l3-kitchen");
    expect(living?.areaSqM).toBeCloseTo(38, 1);
    expect(kitchen?.areaSqM).toBeCloseTo(8.36, 1);
  });

  test("maps a decrease that keeps other floors", () => {
    expect(
      planEdits(
        "decrease the L3 living room size to 40 keeping the remaining floors in the same size.",
        mockFloorPlan,
      ),
    ).toEqual([
      { type: "resize_room", roomId: "l3-living", areaSqM: 40, stack: false },
    ]);
  });

  test("can shrink one floor while the supporting storeys stay", () => {
    const grown = applyAgentAction(mockFloorPlan, {
      type: "resize_room",
      roomId: "l3-living",
      areaSqM: 90,
    });
    const next = applyAgentAction(grown, {
      type: "resize_room",
      roomId: "l3-living",
      areaSqM: 40,
      stack: false,
    });
    const l3 = next.floors.find((floor) => floor.id === "l3");
    const l2 = next.floors.find((floor) => floor.id === "l2");
    const l1 = next.floors.find((floor) => floor.id === "l1") ?? next.floors[0];
    expect(l3?.rooms.find((room) => room.id === "l3-living")?.areaSqM).toBeCloseTo(40, 1);
    expect(l2?.rooms.find((room) => room.id === "l2-living")?.areaSqM).toBeCloseTo(90, 1);
    expect(l1?.rooms.find((room) => room.id === "living")?.areaSqM).toBeCloseTo(90, 1);
  });

  test("grows supporting floors so an upper room is not a cantilever", () => {
    const next = applyAgentAction(mockFloorPlan, {
      type: "resize_room",
      roomId: "l3-living",
      areaSqM: 90,
    });
    const l3 = next.floors.find((floor) => floor.id === "l3");
    const l2 = next.floors.find((floor) => floor.id === "l2");
    const l1 = next.floors.find((floor) => floor.id === "l1") ?? next.floors[0];
    const living = l3?.rooms.find((room) => room.id === "l3-living");
    const kitchen = l3?.rooms.find((room) => room.id === "l3-kitchen");
    const plateY = (floor: (typeof next.floors)[number] | undefined) =>
      Math.max(
        ...(floor?.walls.flatMap((wall) => [wall.start.y, wall.end.y]) ?? [0]),
      );
    expect(living?.areaSqM).toBeCloseTo(90, 1);
    expect(kitchen?.areaSqM).toBeCloseTo(8.36, 1);
    expect(l2?.rooms.find((room) => room.id === "l2-living")?.areaSqM).toBeCloseTo(90, 1);
    expect(l1?.rooms.find((room) => room.id === "living")?.areaSqM).toBeCloseTo(90, 1);
    expect(plateY(l1)).toBeCloseTo(plateY(l3), 1);
    expect(plateY(l2)).toBeCloseTo(plateY(l3), 1);
  });

  test("hides the roof on the current plan", () => {
    const next = applyAgentAction(mockFloorPlan, {
      type: "patch_roof",
      patch: { visible: false },
    });
    expect(next.roof.visible).toBe(false);
    expect(next.floors).toBe(mockFloorPlan.floors);
    expect(next.roof.ridgeHeight).toBe(mockFloorPlan.roof.ridgeHeight);
  });
});
