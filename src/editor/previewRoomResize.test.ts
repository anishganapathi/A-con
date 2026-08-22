import { describe, expect, it } from "vitest";
import { mockFloorPlan } from "../data/mockFloorPlan";
import type { Floor, FloorPlan, Point2D } from "../types/floorPlan";
import { previewRoomResize, resizeRoomInPlan } from "./floorPlanEdits";

function bounds(points: Point2D[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function plateOf(floor: Floor) {
  return bounds(floor.walls.flatMap((wall) => [wall.start, wall.end]));
}

/** A plate with one room floating in the middle of it, so growth has somewhere to go. */
function planWithInteriorRoom(): FloorPlan {
  const corners: Point2D[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  return {
    name: "Test",
    units: "meters",
    floors: [
      {
        id: "f1",
        name: "First Floor",
        elevation: 0,
        walls: corners.map((start, index) => ({
          id: `w${index}`,
          start,
          end: corners[(index + 1) % corners.length],
          height: 3,
          thickness: 0.3,
          type: "exterior" as const,
        })),
        openings: [],
        rooms: [
          {
            id: "core",
            name: "Core",
            boundary: [
              { x: 2, y: 2 },
              { x: 4, y: 2 },
              { x: 4, y: 4 },
              { x: 2, y: 4 },
            ],
            floorHeight: 0,
            labelPosition: { x: 3, y: 3 },
            areaSqM: 4,
          },
        ],
        dimensions: [],
        pipes: [],
        electrical: [],
      },
    ],
    datums: [],
    roof: { type: "flat", eaveHeight: 3, ridgeHeight: 3, overhang: 0.3 },
    source: { project: "Test", sheet: "T1", title: "Test", notes: "" },
  };
}

describe("previewRoomResize", () => {
  it("reports nothing to check for a room that is not in the plan", () => {
    const preview = previewRoomResize(mockFloorPlan, "no-such-room", 40);
    expect(preview.outcome).toBe("missing");
  });

  it("lets an interior room grow into the space it has", () => {
    const preview = previewRoomResize(planWithInteriorRoom(), "core", 6);
    expect(preview.outcome).toBe("fits");
    // 2 m of edge with 4 m to the far wall.
    expect(preview.maxAreaSqM).toBeCloseTo(8, 2);
  });

  it("flags an interior room asked for more than the plate holds", () => {
    const preview = previewRoomResize(planWithInteriorRoom(), "core", 12);
    expect(preview.outcome).toBe("overhangs");
    expect(preview.maxAreaSqM).toBeCloseTo(8, 2);
  });

  it("says the footprint grows when the room owns the facade it is pushing", () => {
    const preview = previewRoomResize(mockFloorPlan, "living", 40);
    expect(preview.outcome).toBe("grows-footprint");
    expect(preview.roomName).toBe("Living Room");
    expect(preview.currentSqM).toBeCloseTo(36, 2);
    expect(preview.maxAreaSqM).toBeCloseTo(36, 2);
    expect(preview.moveMeters).toBeCloseTo(0.4, 2);
    expect(preview.storeys).toBe(3);
    expect(preview.footprintBefore).toBeCloseTo(80, 2);
    expect(preview.footprintAfter).toBeCloseTo(84, 2);
  });

  it("says one storey overhangs when only this floor may move", () => {
    const preview = previewRoomResize(mockFloorPlan, "living", 40, { stack: false });
    expect(preview.outcome).toBe("overhangs");
    expect(preview.storeys).toBe(1);
  });

  it("measures how far a walled-in room would push its wall out", () => {
    const preview = previewRoomResize(mockFloorPlan, "kitchen", 40);
    expect(preview.outcome).toBe("overhangs");
    expect(preview.maxAreaSqM).toBeCloseTo(8.36, 2);
    expect(preview.moveMeters).toBeCloseTo(14.4, 1);
  });

  it("passes a shrink without comment", () => {
    expect(previewRoomResize(mockFloorPlan, "living", 30).outcome).toBe("fits");
    expect(previewRoomResize(mockFloorPlan, "kitchen", 6).outcome).toBe("fits");
  });

  it("describes what the resize actually does to the model", () => {
    // grows-footprint: every storey's plate moves together.
    const grown = resizeRoomInPlan(mockFloorPlan, "living", 40);
    for (const floor of grown.floors) {
      expect(plateOf(floor).maxY).toBeCloseTo(8.4, 2);
    }

    // overhangs: this floor's wall moves and the storeys above stay put, which
    // is the deformation the notice warns about.
    const pushed = resizeRoomInPlan(mockFloorPlan, "kitchen", 40);
    expect(plateOf(pushed.floors[0]).minX).toBeCloseTo(-14.4, 1);
    expect(plateOf(pushed.floors[1]).minX).toBeCloseTo(0, 2);
  });
});
