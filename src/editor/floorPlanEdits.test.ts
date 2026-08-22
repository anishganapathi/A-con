import { describe, expect, test } from "vitest";
import { mockFloorPlan } from "../data/mockFloorPlan";
import { resizeRoomInPlan } from "./floorPlanEdits";

function livingY(floorId: string, plan = mockFloorPlan) {
  const floor = plan.floors.find((entry) => entry.id === floorId) ?? plan.floors[0];
  const room = floor.rooms.find((entry) => /living/i.test(entry.id));
  const ys = room?.boundary.map((point) => point.y) ?? [];
  return { min: Math.min(...ys), max: Math.max(...ys) };
}

function runOn(plan: typeof mockFloorPlan, floorId: string, id: string) {
  const floor = plan.floors.find((entry) => entry.id === floorId);
  return (
    floor?.electrical.find((run) => run.id === id) ??
    floor?.pipes.find((pipe) => pipe.id === id)
  );
}

describe("MEP follows a room resize", () => {
  test("lighting and data in the living room stretch when the plate grows", () => {
    const next = resizeRoomInPlan(mockFloorPlan, "l3-living", 90);
    const living = livingY("l3", next);
    const lighting = runOn(next, "l3", "l3-elec-lighting");
    const data = runOn(next, "l3", "l3-elec-data");
    const kitchen = runOn(next, "l3", "l3-pipe-supply-kitchen");
    const stack = runOn(next, "l3", "l3-pipe-stack-waste");

    expect(lighting?.points.some((point) => point.y > 8)).toBe(true);
    expect(lighting?.points.every((point) => point.y <= living.max + 0.05)).toBe(true);
    expect(data?.points.some((point) => point.y > 8)).toBe(true);
    expect(kitchen?.points.every((point) => point.y <= 3.6)).toBe(true);
    expect(stack?.points.every((point) => point.x === 9.35 && point.y === 3.5)).toBe(true);
  });

  test("a grown living circuit reaches into the new volume", () => {
    const next = resizeRoomInPlan(mockFloorPlan, "l3-living", 90);
    const living = livingY("l3", next);
    const lighting = runOn(next, "l3", "l3-elec-lighting");
    const farthest = Math.max(...(lighting?.points.map((point) => point.y) ?? [0]));
    expect(living.max - farthest).toBeLessThan(1.4);
  });

  test("setback shrink pulls L3 wires back and leaves L2 runs", () => {
    const grown = resizeRoomInPlan(mockFloorPlan, "l3-living", 90);
    const next = resizeRoomInPlan(grown, "l3-living", 40, { stack: false });
    const l3 = livingY("l3", next);
    const l3Light = runOn(next, "l3", "l3-elec-lighting");
    const l2Light = runOn(next, "l2", "l2-elec-lighting");
    const grownLight = runOn(grown, "l2", "l2-elec-lighting");

    expect(l3Light?.points.every((point) => point.y <= l3.max + 0.05)).toBe(true);
    expect(l2Light?.points.map((point) => point.y)).toEqual(
      grownLight?.points.map((point) => point.y),
    );
  });
});
