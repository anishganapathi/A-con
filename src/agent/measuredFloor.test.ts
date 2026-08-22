import { describe, expect, test } from "vitest";
import type { Floor } from "../types/floorPlan";
import type { BuildingSpec } from "./buildingSpec";
import { compileSpec } from "./compileSpec";
import { tidyZones } from "./measuredFloor";

/** The 25' x 40' bungalow sheet, as the vision model reports it. */
const sheet: Partial<BuildingSpec> = {
  name: "Bungalow",
  typology: "residential",
  width: 7.6,
  depth: 12.2,
  stories: 2,
  storyHeight: 3,
  measured: true,
  levels: [
    {
      name: "Ground Floor",
      zones: [
        { id: "z1", name: "Bedroom", x: 0, y: 6.4, w: 4.3, h: 4.4, kind: "living" },
        { id: "z2", name: "Bedroom", x: 0, y: 3.2, w: 4.3, h: 3.2, kind: "living" },
        { id: "z3", name: "Toilet", x: 0, y: 1.2, w: 2.4, h: 1.2, kind: "wet" },
        { id: "z4", name: "Hall", x: 3.6, y: 0, w: 4, h: 8.8, kind: "circulation" },
        { id: "z5", name: "Parking", x: 4.6, y: 0, w: 3, h: 5.1, kind: "entry" },
      ],
    },
    {
      name: "First Floor",
      zones: [
        { id: "z1", name: "Bedroom", x: 0, y: 6.4, w: 4.3, h: 4.4, kind: "living" },
        { id: "z2", name: "Kitchen", x: 5.2, y: 8.2, w: 2.4, h: 2.6, kind: "wet" },
        { id: "z3", name: "Drawing", x: 4.3, y: 3.4, w: 3.3, h: 4.6, kind: "living" },
        { id: "z4", name: "Bedroom", x: 0, y: 2.4, w: 3.7, h: 4, kind: "living" },
        { id: "z5", name: "Balcony", x: 4.3, y: 0, w: 3.3, h: 2.4, kind: "living" },
      ],
    },
  ],
};

function overlaps(a: Floor["rooms"][number], b: Floor["rooms"][number]): boolean {
  const box = (room: Floor["rooms"][number]) => ({
    x0: Math.min(...room.boundary.map((point) => point.x)),
    x1: Math.max(...room.boundary.map((point) => point.x)),
    y0: Math.min(...room.boundary.map((point) => point.y)),
    y1: Math.max(...room.boundary.map((point) => point.y)),
  });
  const one = box(a);
  const two = box(b);
  return (
    Math.min(one.x1, two.x1) - Math.max(one.x0, two.x0) > 0.05 &&
    Math.min(one.y1, two.y1) - Math.max(one.y0, two.y0) > 0.05
  );
}

describe("traced plan sheets", () => {
  test("builds only the storeys the sheet draws", () => {
    const plan = compileSpec(sheet);
    expect(plan.floors).toHaveLength(2);
    expect(plan.floors.map((floor) => floor.name)).toEqual([
      "Ground Floor",
      "First Floor",
    ]);
  });

  test("each floor keeps its own program", () => {
    const plan = compileSpec(sheet);
    const names = plan.floors.map((floor) =>
      floor.rooms.map((room) => room.name).sort().join(","),
    );
    expect(names[0]).not.toEqual(names[1]);
    expect(names[1]).toMatch(/Kitchen/);
    expect(names[0]).toMatch(/Parking/);
  });

  test("the ground floor gets one entrance, not a door per wall", () => {
    const [ground] = compileSpec(sheet).floors;
    const exteriorIds = new Set(
      ground.walls.filter((wall) => wall.type === "exterior").map((wall) => wall.id),
    );
    const entrances = ground.openings.filter(
      (opening) => opening.type === "door" && exteriorIds.has(opening.wallId),
    );
    expect(entrances.length).toBeGreaterThanOrEqual(1);
    expect(entrances.length).toBeLessThanOrEqual(2);
    const interior = ground.openings.filter(
      (opening) => opening.type === "door" && !exteriorIds.has(opening.wallId),
    );
    expect(interior.length).toBeLessThanOrEqual(ground.rooms.length);
  });

  test("a parking bay does not cost the house its front door", () => {
    const [ground] = compileSpec(sheet).floors;
    const doors = ground.openings.filter((opening) => opening.type === "door");
    expect(doors.some((door) => door.id.includes("garage"))).toBe(true);
    const entry = doors.find((door) => door.id.endsWith("door-entry"));
    expect(entry).toBeDefined();
    expect(entry?.width).toBeCloseTo(1.1, 1);
  });

  test("openings never punch the same stretch of wall twice", () => {
    for (const floor of compileSpec(sheet).floors) {
      const byWall = new Map<string, [number, number][]>();
      for (const opening of floor.openings) {
        const span: [number, number] = [
          opening.offsetFromStart,
          opening.offsetFromStart + opening.width,
        ];
        for (const other of byWall.get(opening.wallId) ?? []) {
          expect(span[1] <= other[0] || span[0] >= other[1]).toBe(true);
        }
        byWall.set(opening.wallId, [...(byWall.get(opening.wallId) ?? []), span]);
      }
    }
  });

  test("openings stay inside the wall they sit on", () => {
    for (const floor of compileSpec(sheet).floors) {
      for (const opening of floor.openings) {
        const wall = floor.walls.find((entry) => entry.id === opening.wallId);
        const length = Math.hypot(
          (wall?.end.x ?? 0) - (wall?.start.x ?? 0),
          (wall?.end.y ?? 0) - (wall?.start.y ?? 0),
        );
        expect(opening.offsetFromStart).toBeGreaterThanOrEqual(0);
        expect(opening.offsetFromStart + opening.width).toBeLessThanOrEqual(length);
      }
    }
  });

  test("upper floors have no front door", () => {
    const [, first] = compileSpec(sheet).floors;
    const exteriorIds = new Set(
      first.walls.filter((wall) => wall.type === "exterior").map((wall) => wall.id),
    );
    expect(
      first.openings.filter(
        (opening) => opening.type === "door" && exteriorIds.has(opening.wallId),
      ),
    ).toHaveLength(0);
  });

  test("rooms tile the plate instead of overlapping", () => {
    for (const floor of compileSpec(sheet).floors) {
      for (const [index, room] of floor.rooms.entries()) {
        for (const other of floor.rooms.slice(index + 1)) {
          expect(overlaps(room, other)).toBe(false);
        }
      }
    }
  });

  test("shared edges make one partition, not two", () => {
    const [ground] = compileSpec(sheet).floors;
    const keys = ground.walls.map(
      (wall) =>
        `${wall.start.x.toFixed(2)},${wall.start.y.toFixed(2)}-${wall.end.x.toFixed(2)},${wall.end.y.toFixed(2)}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  test("every opening sits on a wall of its own floor", () => {
    for (const floor of compileSpec(sheet).floors) {
      const ids = new Set(floor.walls.map((wall) => wall.id));
      for (const opening of floor.openings) {
        expect(ids.has(opening.wallId)).toBe(true);
      }
    }
  });
});

describe("tidyZones", () => {
  test("clips to the plate and drops the loser of an overlap", () => {
    const zones = tidyZones(
      [
        { id: "a", name: "Hall", x: 0, y: 0, w: 6, h: 6, kind: "circulation" },
        { id: "b", name: "Bed", x: 4, y: 0, w: 6, h: 6, kind: "living" },
      ],
      8,
      6,
    );
    expect(zones).toHaveLength(2);
    const bed = zones.find((zone) => zone.id === "b");
    expect(bed?.x).toBeGreaterThanOrEqual(6);
    expect((bed?.x ?? 0) + (bed?.w ?? 0)).toBeLessThanOrEqual(8.01);
  });

  test("keeps a bay the model drew inside an over-long room", () => {
    // The hall was reported 8.8 m deep, swallowing the parking bay whole.
    const zones = tidyZones(
      [
        { id: "hall", name: "Hall", x: 3.6, y: 0, w: 4, h: 8.8, kind: "circulation" },
        { id: "park", name: "Parking", x: 4.6, y: 0, w: 3, h: 5.1, kind: "entry" },
      ],
      7.6,
      12.2,
    );

    const park = zones.find((zone) => zone.id === "park");
    const hall = zones.find((zone) => zone.id === "hall");
    expect(park).toBeDefined();
    expect(hall).toBeDefined();
    expect(Math.min(park!.w, park!.h)).toBeGreaterThan(1.5);
    expect(Math.min(hall!.w, hall!.h)).toBeGreaterThan(1.5);
  });

  test("keeps a 4'-deep toilet", () => {
    const zones = tidyZones(
      [
        { id: "bed", name: "Bedroom", x: 0, y: 2, w: 4.3, h: 4.4, kind: "living" },
        { id: "wc", name: "Toilet", x: 0, y: 0, w: 2.4, h: 1.2, kind: "wet" },
      ],
      7.6,
      12.2,
    );

    const wc = zones.find((zone) => zone.id === "wc");
    expect(zones.map((zone) => zone.id)).toContain("bed");
    expect(wc?.h).toBeCloseTo(1.2, 1);
  });

  test("turns the leftover void into circulation", () => {
    const zones = tidyZones(
      [
        { id: "a", name: "Bedroom", x: 0, y: 0, w: 3.5, h: 3, kind: "living" },
        { id: "b", name: "Drawing", x: 4.5, y: 0, w: 3.1, h: 3, kind: "living" },
      ],
      7.6,
      3,
    );

    const landing = zones.find((zone) => zone.kind === "circulation");
    expect(landing).toBeDefined();
    expect(landing!.x).toBeCloseTo(3.5, 1);
    expect(landing!.w).toBeCloseTo(1, 1);
  });

  test("drops slivers left after carving", () => {
    const zones = tidyZones(
      [
        { id: "a", name: "Hall", x: 0, y: 0, w: 7.8, h: 6, kind: "circulation" },
        { id: "b", name: "Nook", x: 7.5, y: 0, w: 0.5, h: 6, kind: "living" },
      ],
      8,
      6,
    );
    expect(zones.map((zone) => zone.id)).toEqual(["a"]);
  });
});
