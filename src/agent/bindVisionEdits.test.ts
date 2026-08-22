import { describe, expect, test } from "vitest";
import { mockFloorPlan } from "../data/mockFloorPlan";
import { bindVisionEdits, resolveRoomId, visionEditReply } from "./bindVisionEdits";

describe("bindVisionEdits", () => {
  test("maps l1-living onto the ground-floor living room", () => {
    expect(resolveRoomId(mockFloorPlan, "l1-living")).toBe("living");
    expect(resolveRoomId(mockFloorPlan, "l3-living")).toBe("l3-living");
  });

  test("maps l1-living and drops a no-op roof toggle", () => {
    expect(
      bindVisionEdits(mockFloorPlan, [
        { type: "patch_roof", patch: { visible: true } },
        { type: "resize_room", roomId: "l1-living", areaSqM: 90 },
      ]),
    ).toEqual([{ type: "resize_room", roomId: "living", areaSqM: 90 }]);
  });

  test("keeps a resize the user actually asked for", () => {
    expect(
      bindVisionEdits(
        mockFloorPlan,
        [{ type: "resize_room", roomId: "l3-living", areaSqM: 90 }],
        "increase the L3 living room size to 90 m",
      ),
    ).toEqual([{ type: "resize_room", roomId: "l3-living", areaSqM: 90 }]);
  });

  test("turns a patch_room area into a real resize", () => {
    expect(
      bindVisionEdits(mockFloorPlan, [
        {
          type: "patch_room",
          roomId: "living room",
          patch: { area: 19 },
        },
      ]),
    ).toEqual([{ type: "resize_room", roomId: "living", areaSqM: 19 }]);
  });

  test("accepts resize aliases from the VL", () => {
    expect(
      bindVisionEdits(mockFloorPlan, [
        { type: "resize_room", room: "living", area: 19 } as never,
      ]),
    ).toEqual([{ type: "resize_room", roomId: "living", areaSqM: 19 }]);
  });

  test("does not crash when the VL omits patch", () => {
    expect(
      bindVisionEdits(mockFloorPlan, [
        { type: "patch_roof" } as never,
        { type: "patch_roof", ridgeHeight: 13.4 } as never,
      ]),
    ).toEqual([{ type: "patch_roof", patch: { ridgeHeight: 13.4 } }]);
  });

  test("reads an opening patch the VL nested under properties", () => {
    // The live model answers "give the window more gap" with {properties:{x:1}}.
    expect(
      bindVisionEdits(mockFloorPlan, [
        { type: "patch_opening", id: "l3-win-e", properties: { x: 1 } } as never,
      ]),
    ).toEqual([
      { type: "patch_opening", openingId: "l3-win-e", patch: { offsetFromStart: 1 } },
    ]);
  });

  test("keeps a widened opening inside its wall", () => {
    // l3-win-n2 sits on a 10 m wall, so a 10 m ask cannot be taken literally.
    expect(
      bindVisionEdits(mockFloorPlan, [
        { type: "patch_opening", id: "l3-win-n2", properties: { w: 10 } } as never,
      ]),
    ).toEqual([{ type: "patch_opening", openingId: "l3-win-n2", patch: { width: 9.8 } }]);
  });

  test("slides an opening when the model sends a relative shift", () => {
    expect(
      bindVisionEdits(mockFloorPlan, [
        { type: "patch_opening", openingId: "l3-win-n2", patch: { shift: -1.5 } } as never,
      ]),
    ).toEqual([{ type: "patch_opening", openingId: "l3-win-n2", patch: { offsetFromStart: 5 } }]);
  });

  test("drops an opening patch that would change nothing", () => {
    expect(
      bindVisionEdits(mockFloorPlan, [
        { type: "patch_opening", openingId: "l3-win-n2", patch: { gap: 10 } } as never,
        { type: "patch_opening", openingId: "l3-win-n2", patch: { width: 1.4 } } as never,
      ]),
    ).toEqual([]);
  });

  test("drops an opening patch aimed at a window already removed", () => {
    expect(
      bindVisionEdits(mockFloorPlan, [
        { type: "patch_opening", id: "l3-win-gone", properties: { x: 2 } } as never,
      ]),
    ).toEqual([]);
  });

  test("does not claim the roof became multi-gable", () => {
    expect(visionEditReply("The elevation shows a multi-gable house.", [])).toMatch(
      /cannot add extra gables/i,
    );
  });
});
