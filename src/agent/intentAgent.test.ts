import { describe, expect, test } from "vitest";
import { mockFloorPlan } from "../data/mockFloorPlan";
import { actionsFromIntent, interpretIntent } from "./intentAgent";

describe("intent agent", () => {
  test("reads a decrease that keeps other floors from the live room names", () => {
    const intent = interpretIntent(
      "decrease the L3 living room size to 40 keeping the remaining floors in the same size.",
      mockFloorPlan,
    );
    expect(intent).toEqual({
      role: "edit",
      kind: "resize_room",
      roomId: "l3-living",
      areaSqM: 40,
      stack: false,
    });
    expect(actionsFromIntent(intent)).toEqual([
      { type: "resize_room", roomId: "l3-living", areaSqM: 40, stack: false },
    ]);
  });

  test("stacks supporting floors when the user does not say otherwise", () => {
    const intent = interpretIntent("increase the L3 living room size to 90 m", mockFloorPlan);
    expect(intent.kind).toBe("resize_room");
    if (intent.kind === "resize_room") {
      expect(intent.stack).toBe(true);
      expect(intent.areaSqM).toBe(90);
    }
  });

  test("treats add the roof as putting it back", () => {
    expect(interpretIntent("add the roof", mockFloorPlan).kind).toBe("show_roof");
  });

  test("keeps the roof without dumping an explanation", () => {
    expect(interpretIntent("Keep the roof", mockFloorPlan)).toEqual({
      role: "edit",
      kind: "keep_roof",
    });
  });

  test("reads removing the roof as hide", () => {
    expect(interpretIntent("removing the roof", mockFloorPlan).kind).toBe("hide_roof");
  });

  test("does not need a rigid sentence shape to find the room", () => {
    const intent = interpretIntent("make l3 living 38", mockFloorPlan);
    expect(intent).toMatchObject({
      kind: "resize_room",
      roomId: "l3-living",
      areaSqM: 38,
    });
  });

  test("reads an everyday grow-the-living-room line", () => {
    const intent = interpretIntent("increase the living room to 40m", mockFloorPlan);
    expect(intent).toMatchObject({
      kind: "resize_room",
      roomId: "living",
      areaSqM: 40,
      stack: true,
    });
  });

  test("reads a from-to resize and picks the room by its current area", () => {
    const plan = {
      ...mockFloorPlan,
      floors: mockFloorPlan.floors.map((floor) =>
        floor.id === "l2"
          ? {
              ...floor,
              rooms: floor.rooms.map((room) =>
                room.id === "l2-living" ? { ...room, areaSqM: 16.4 } : room,
              ),
            }
          : floor,
      ),
    };
    const intent = interpretIntent(
      "increase the size of the living room from 16.4 m to 19 m",
      plan,
    );
    expect(intent).toMatchObject({
      kind: "resize_room",
      roomId: "l2-living",
      areaSqM: 19,
    });
  });
});
