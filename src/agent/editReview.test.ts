import { describe, expect, it } from "vitest";
import { mockFloorPlan } from "../data/mockFloorPlan";
import type { FloorPlan, Point2D } from "../types/floorPlan";
import { reviewEdits } from "./editReview";
import type { AgentAction } from "./types";

/** A plate with one room floating in it, so a resize has somewhere to go. */
function planWithInteriorRoom(): FloorPlan {
  const corners: Point2D[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  return {
    ...mockFloorPlan,
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
  };
}

const resize = (roomId: string, areaSqM: number, stack?: boolean): AgentAction => ({
  type: "resize_room",
  roomId,
  areaSqM,
  ...(stack === undefined ? {} : { stack }),
});

describe("reviewEdits", () => {
  it("passes a turn with nothing to resize", () => {
    expect(reviewEdits(mockFloorPlan, [])).toBeNull();
    expect(
      reviewEdits(mockFloorPlan, [{ type: "patch_roof", patch: { overhang: 0.5 } }]),
    ).toBeNull();
  });

  it("passes a resize the plate absorbs", () => {
    // A room with space around it grows into that space: no wall moves, so there
    // is nothing to ask about.
    expect(reviewEdits(planWithInteriorRoom(), [resize("core", 6)])).toBeNull();
  });

  it("questions a shrink that pulls the facade in with it", () => {
    // Shrinking the living room drags the north wall inward on every storey, so
    // the house gets shorter. Quieter than an overflow, and just as unasked for.
    const notice = reviewEdits(mockFloorPlan, [resize("living", 30)]);
    expect(notice?.severity).toBe("grows-footprint");
    expect(notice?.detail).toContain("80");
    expect(notice?.detail).toContain("74");
  });

  it("passes a room it cannot find, leaving the agent to say so", () => {
    expect(reviewEdits(mockFloorPlan, [resize("nope", 40)])).toBeNull();
  });

  it("questions a resize that moves the facade on every storey", () => {
    const notice = reviewEdits(mockFloorPlan, [resize("living", 40)]);
    expect(notice).not.toBeNull();
    expect(notice?.severity).toBe("grows-footprint");
    expect(notice?.title).toContain("Living Room");
    expect(notice?.title).toContain("40");
    // The numbers a person needs to decide: the ceiling, the travel, the storeys
    // affected and the footprint either side of the change.
    expect(notice?.detail).toContain("36");
    expect(notice?.detail).toContain("0.4 m");
    expect(notice?.detail).toContain("3 storeys");
    expect(notice?.detail).toContain("80");
    expect(notice?.detail).toContain("84");
  });

  it("questions a resize that would leave a storey overhanging", () => {
    const notice = reviewEdits(mockFloorPlan, [resize("kitchen", 40)]);
    expect(notice?.severity).toBe("overhangs");
    expect(notice?.detail).toContain("14.4 m");
  });

  it("offers the largest size that fits, and labels it honestly", () => {
    const notice = reviewEdits(mockFloorPlan, [resize("living", 40)]);
    // The living room already reaches the north wall, so the fitting size is
    // the size it has — the button must not promise a change.
    expect(notice?.fitLabel).toBe("Keep 36 m²");
    expect(notice?.trimmed).toEqual([resize("living", 36)]);
    expect(notice?.asked).toEqual([resize("living", 40)]);
  });

  it("carries the rest of the turn through both answers untouched", () => {
    const rename: AgentAction = {
      type: "patch_room",
      roomId: "kitchen",
      patch: { name: "Galley" },
    };
    const notice = reviewEdits(mockFloorPlan, [rename, resize("living", 40)]);
    expect(notice?.asked).toEqual([rename, resize("living", 40)]);
    expect(notice?.trimmed).toEqual([rename, resize("living", 36)]);
  });

  it("counts the other changes it is holding back", () => {
    const notice = reviewEdits(mockFloorPlan, [
      resize("living", 40),
      resize("kitchen", 40),
    ]);
    expect(notice?.detail).toContain("1 other change");
    expect(notice?.trimmed).toEqual([resize("living", 36), resize("kitchen", 8.36)]);
  });

  it("measures each change against the plan the one before it leaves", () => {
    // The first resize grows the plate to 10 × 8.4 and the room to 40 m², so the
    // second asks for a size it already has and needs no warning of its own.
    const notice = reviewEdits(mockFloorPlan, [resize("living", 40), resize("living", 40)]);
    expect(notice?.detail).not.toContain("other change");
  });

  it("treats a single-storey resize as an overhang, whatever the room owns", () => {
    const notice = reviewEdits(mockFloorPlan, [resize("living", 40, false)]);
    expect(notice?.severity).toBe("overhangs");
    expect(notice?.detail).toContain("First Floor");
  });
});

/**
 * The model does not always reach for resize_room: it often moves the walls
 * itself. The shell check works on the result rather than the wording, so those
 * turns are held to the same standard.
 */
describe("reviewEdits · walls moved directly", () => {
  const northWalls = (floorId: string) =>
    mockFloorPlan.floors
      .find((floor) => floor.id === floorId)!
      .walls.filter((wall) => wall.start.y === 8 || wall.end.y === 8);

  const pushNorth = (floorId: string, to: number): AgentAction[] =>
    northWalls(floorId).map((wall) => ({
      type: "patch_wall",
      wallId: wall.id,
      patch: {
        start: { ...wall.start, y: wall.start.y === 8 ? to : wall.start.y },
        end: { ...wall.end, y: wall.end.y === 8 ? to : wall.end.y },
      },
    }));

  it("passes an edit that leaves the shell where it is", () => {
    expect(
      reviewEdits(mockFloorPlan, [
        { type: "patch_room", roomId: "living", patch: { name: "Lounge" } },
      ]),
    ).toBeNull();
  });

  it("passes a room area written on the label without moving anything", () => {
    expect(
      reviewEdits(mockFloorPlan, [
        { type: "patch_room", roomId: "living", patch: { areaSqM: 40 } },
      ]),
    ).toBeNull();
  });

  it("questions walls pushed out on every storey", () => {
    const notice = reviewEdits(mockFloorPlan, [
      ...pushNorth("l1", 8.4),
      ...pushNorth("l2", 8.4),
      ...pushNorth("l3", 8.4),
    ]);
    expect(notice?.severity).toBe("grows-footprint");
    expect(notice?.detail).toContain("0.4 m");
    expect(notice?.detail).toContain("84");
    // Nothing to clamp: the change is not phrased as an area.
    expect(notice?.fitLabel).toBeUndefined();
    expect(notice?.trimmed).toEqual([]);
  });

  it("questions walls pushed out on one storey only", () => {
    const notice = reviewEdits(mockFloorPlan, pushNorth("l1", 11));
    expect(notice?.severity).toBe("overhangs");
    expect(notice?.detail).toContain("First Floor");
    expect(notice?.detail).toContain("3 m");
  });

  it("leaves a wholesale replacement alone, which is a new building not an edit", () => {
    expect(
      reviewEdits(mockFloorPlan, [
        {
          type: "replace_plan",
          plan: { ...mockFloorPlan, floors: [mockFloorPlan.floors[0]] },
          note: "Built something else",
        },
      ]),
    ).toBeNull();
  });
});
