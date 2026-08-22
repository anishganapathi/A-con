import { describe, expect, test } from "vitest";
import type { Point2D } from "../types/floorPlan";
import type { MassingVolume } from "./buildingSpec";
import { footprintBounds, normalizeSpec, polygonArea } from "./buildingSpec";
import { compileSpec } from "./compileSpec";

/** An L-shaped plate, counter-clockwise, already sitting on the origin. */
const lShape: Point2D[] = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 14 },
  { x: 18, y: 14 },
  { x: 18, y: 30 },
  { x: 0, y: 30 },
];

function signedArea(points: Point2D[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function offset(points: Point2D[], dx: number, dy: number): Point2D[] {
  return points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
}

function box(minX: number, minY: number, maxX: number, maxY: number): Point2D[] {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

function band(minHeight: number, maxHeight: number, polygon: Point2D[]): MassingVolume {
  return {
    id: "",
    polygon,
    minHeight,
    maxHeight,
    roofShape: null,
    roofHeight: 0,
  };
}

describe("model-authored outline", () => {
  test("builds from the outline rather than its bounding box", () => {
    const spec = normalizeSpec({ typology: "office", footprint: lShape });

    expect(spec.footprint).toHaveLength(6);
    expect(polygonArea(spec.footprint!)).toBeLessThan(40 * 30 * 0.95);
  });

  test("sizes the building from the outline", () => {
    const spec = normalizeSpec({ typology: "office", footprint: lShape, width: 5, depth: 5 });

    expect(spec.width).toBeCloseTo(40, 1);
    expect(spec.depth).toBeCloseTo(30, 1);
  });

  test("moves an outline drawn away from the origin back onto it", () => {
    const spec = normalizeSpec({
      typology: "office",
      footprint: offset(lShape, 500, -300),
    });
    const bounds = footprintBounds(spec.footprint!);

    expect(bounds.minX).toBeCloseTo(0, 1);
    expect(bounds.minY).toBeCloseTo(0, 1);
  });

  test("drops the repeated point that closes a ring", () => {
    const spec = normalizeSpec({
      typology: "office",
      footprint: [...box(0, 0, 40, 30), { x: 0, y: 0 }],
    });

    expect(spec.footprint).toHaveLength(4);
  });

  test("winds a clockwise outline the other way", () => {
    const spec = normalizeSpec({
      typology: "office",
      footprint: [...lShape].reverse(),
    });

    expect(signedArea(spec.footprint!)).toBeGreaterThan(0);
  });

  test("does not copy a 3-storey live model onto a measured bungalow sheet", () => {
    const spec = normalizeSpec({
      typology: "residential",
      width: 25,
      depth: 40,
      stories: 3,
      storyHeight: 3.6,
      measured: true,
    });
    expect(spec.stories).toBe(2);
    expect(spec.storyHeight).toBe(3);
  });

  test("reads rooms stuffed into footprint and drops invented upper floors", () => {
    const spec = normalizeSpec({
      typology: "residential",
      width: 7.6,
      depth: 12.2,
      stories: 2,
      measured: true,
      roof: { type: "gable" } as never,
      footprint: [
        {
          name: "Ground Floor",
          zones: [{ id: "parking", name: "Parking", x: 4.6, y: 0, w: 3, h: 5.1, kind: "entry" }],
        },
        {
          name: "First Floor",
          zones: [{ id: "kitchen", name: "Kitchen", x: 4.3, y: 7.6, w: 2.4, h: 3, kind: "wet" }],
        },
        {
          name: "Second Floor",
          zones: [{ id: "l2", name: "L2 Living Room", x: 0, y: 0, w: 7.6, h: 4.4, kind: "living" }],
        },
      ] as never,
    });
    expect(spec.stories).toBe(2);
    expect(spec.levels?.map((level) => level.name)).toEqual(["Ground Floor", "First Floor"]);
    expect(spec.roof).toBe("standing-seam");
  });

  test("keeps different rooms on each storey from the sheet", () => {
    const spec = normalizeSpec({
      typology: "residential",
      width: 7.6,
      depth: 12.2,
      measured: true,
      levels: [
        {
          name: "Ground Floor",
          zones: [{ id: "parking", name: "Parking", x: 4, y: 0, w: 3, h: 5, kind: "entry" }],
        },
        {
          name: "First Floor",
          zones: [{ id: "kitchen", name: "Kitchen", x: 4, y: 8, w: 2.4, h: 3, kind: "wet" }],
        },
      ],
    });
    expect(spec.stories).toBe(2);
    expect(spec.levels?.[0].zones[0].name).toBe("Parking");
    expect(spec.levels?.[1].zones[0].name).toBe("Kitchen");
  });

  test("converts a 25 × 40 ft bungalow plate to metres", () => {
    const spec = normalizeSpec({
      typology: "residential",
      width: 25,
      depth: 40,
      stories: 2,
      measured: true,
    });
    expect(spec.width).toBeCloseTo(7.6, 1);
    expect(spec.depth).toBeCloseTo(12.2, 1);
    expect(spec.measured).toBe(true);
  });

  test("ignores a footprint object that is not a ring", () => {
    const spec = normalizeSpec({
      typology: "residential",
      width: 12,
      depth: 9,
      stories: 2,
      footprint: { width: 12, depth: 9 } as never,
    });
    expect(spec.footprint).toBeUndefined();
    expect(spec.width).toBe(12);
    expect(spec.stories).toBe(2);
  });

  test("ignores an outline with no area", () => {
    const spec = normalizeSpec({
      typology: "office",
      footprint: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 0 },
      ],
      width: 30,
      depth: 20,
    });

    expect(spec.footprint).toBeUndefined();
    expect(spec.width).toBe(30);
  });

  test("ignores an outline larger than any real building", () => {
    const spec = normalizeSpec({
      typology: "office",
      footprint: box(0, 0, 2000, 1500),
    });

    expect(spec.footprint).toBeUndefined();
    expect(spec.width).toBeLessThanOrEqual(120);
  });

  test("thins an over-detailed outline", () => {
    const circle: Point2D[] = Array.from({ length: 90 }, (_, index) => {
      const angle = (index / 90) * Math.PI * 2;
      return { x: 20 + Math.cos(angle) * 20, y: 20 + Math.sin(angle) * 20 };
    });
    const spec = normalizeSpec({ typology: "office", footprint: circle });

    expect(spec.footprint!.length).toBeLessThanOrEqual(24);
    expect(spec.footprint!.length).toBeGreaterThanOrEqual(8);
  });
});

describe("model-authored massing", () => {
  test("orders bands from the ground up", () => {
    const spec = normalizeSpec({
      typology: "office",
      footprint: box(0, 0, 40, 30),
      massing: [
        band(60, 120, box(10, 8, 30, 22)),
        band(0, 60, box(0, 0, 40, 30)),
      ],
    });

    expect(spec.massing?.map((volume) => volume.minHeight)).toEqual([0, 60]);
  });

  test("drops bands that do not rise", () => {
    const spec = normalizeSpec({
      typology: "office",
      footprint: box(0, 0, 40, 30),
      massing: [
        band(0, 60, box(0, 0, 40, 30)),
        band(60, 60, box(10, 8, 30, 22)),
        band(90, 70, box(10, 8, 30, 22)),
      ],
    });

    expect(spec.massing).toHaveLength(1);
  });

  test("drops bands whose polygon cannot be built", () => {
    const spec = normalizeSpec({
      typology: "office",
      footprint: box(0, 0, 40, 30),
      massing: [
        band(0, 60, box(0, 0, 40, 30)),
        band(60, 90, [{ x: 1, y: 1 }, { x: 2, y: 2 }]),
      ],
    });

    expect(spec.massing).toHaveLength(1);
  });

  test("shifts bands along with the outline", () => {
    const spec = normalizeSpec({
      typology: "office",
      footprint: offset(box(0, 0, 40, 30), 500, -300),
      massing: [
        band(0, 60, offset(box(0, 0, 40, 30), 500, -300)),
        band(60, 120, offset(box(10, 8, 30, 22), 500, -300)),
      ],
    });
    const tower = footprintBounds(spec.massing![1].polygon);

    expect(tower.minX).toBeCloseTo(10, 1);
    expect(tower.minY).toBeCloseTo(8, 1);
  });

  test("names every band so floors can be keyed", () => {
    const spec = normalizeSpec({
      typology: "office",
      footprint: box(0, 0, 40, 30),
      massing: [band(0, 60, box(0, 0, 40, 30)), band(60, 120, box(10, 8, 30, 22))],
    });
    const ids = spec.massing!.map((volume) => volume.id);

    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });

  test("caps a runaway list of bands", () => {
    const many = Array.from({ length: 60 }, (_, index) =>
      band(index * 4, index * 4 + 4, box(0, 0, 40 - index * 0.5, 30 - index * 0.3)),
    );
    const spec = normalizeSpec({
      typology: "office",
      footprint: box(0, 0, 40, 30),
      massing: many,
    });

    expect(spec.massing!.length).toBeLessThanOrEqual(16);
  });
});

describe("model-authored tip height", () => {
  test("clamps a tip taller than any structure", () => {
    const plan = compileSpec({
      typology: "office",
      footprint: box(0, 0, 40, 30),
      stories: 10,
      storyHeight: 4,
      tipHeight: 99_999,
    });

    expect(plan.roof.ridgeHeight).toBeLessThan(800);
    expect(plan.floors.length).toBeLessThan(200);
  });

  test("still models a plausible tip", () => {
    const plan = compileSpec({
      typology: "office",
      footprint: box(0, 0, 40, 30),
      stories: 10,
      storyHeight: 4,
      tipHeight: 70,
    });

    expect(plan.roof.ridgeHeight).toBeGreaterThanOrEqual(70);
  });
});

describe("levels padded past the sheet", () => {
  const drawn = [
    { id: "a", name: "Hall", x: 0, y: 0, w: 4, h: 6, kind: "circulation" as const },
    { id: "b", name: "Bedroom", x: 4, y: 0, w: 4, h: 6, kind: "living" as const },
  ];
  const padded = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      name: index === 0 ? "Ground Floor" : index === 1 ? "First Floor" : `Level ${index + 1}`,
      zones: drawn.map((zone) => ({ ...zone, name: `L${index + 1} ${zone.name}` })),
    }));

  test("keeps only the storeys the model declared", () => {
    const spec = normalizeSpec({
      typology: "residential",
      width: 8,
      depth: 6,
      stories: 2,
      measured: true,
      levels: padded(12),
    });

    expect(spec.stories).toBe(2);
    expect(spec.levels).toHaveLength(2);
  });

  test("stops at a plate that repeats an earlier one", () => {
    const spec = normalizeSpec({
      typology: "residential",
      width: 8,
      depth: 6,
      measured: true,
      levels: [
        { name: "Ground Floor", zones: drawn },
        { name: "First Floor", zones: drawn.map((zone) => ({ ...zone, y: zone.y + 0 })) },
        { name: "Roof Terrace", zones: drawn },
      ],
    });

    expect(spec.levels).toHaveLength(2);
  });
});

