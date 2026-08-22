import { describe, expect, test } from "vitest";
import type { FloorPlan, Wall } from "../types/floorPlan";
import {
  createDriftPositions,
  getExperienceFraming,
  getExperienceShadowRig,
} from "./experienceFraming";

function wall(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return {
    id,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    height: 3.2,
    thickness: 0.3,
    type: "exterior",
  };
}

function planFrom(box: { minX: number; minY: number; maxX: number; maxY: number }, ridge: number): FloorPlan {
  return {
    name: "fixture",
    units: "meters",
    floors: [
      {
        id: "l1",
        name: "Level 1",
        elevation: 0,
        walls: [
          wall("w1", box.minX, box.minY, box.maxX, box.minY),
          wall("w2", box.maxX, box.minY, box.maxX, box.maxY),
          wall("w3", box.maxX, box.maxY, box.minX, box.maxY),
          wall("w4", box.minX, box.maxY, box.minX, box.minY),
        ],
        openings: [],
        rooms: [],
        dimensions: [],
        pipes: [],
        electrical: [],
      },
    ],
    datums: [],
    roof: { type: "flat", eaveHeight: ridge - 0.3, ridgeHeight: ridge, overhang: 0.2 },
    source: { project: "p", sheet: "s", title: "t", notes: "n" },
  };
}

const emptyPlan: FloorPlan = {
  name: "empty",
  units: "meters",
  floors: [],
  datums: [],
  roof: { type: "flat", eaveHeight: 0, ridgeHeight: 0, overhang: 0 },
  source: { project: "p", sheet: "s", title: "t", notes: "n" },
};

/** A tower the agent can produce: small plate, very tall. */
const tower = planFrom({ minX: 40, minY: 60, maxX: 62, maxY: 78 }, 148);
/** A wide low-rise well away from the world origin. */
const lowRise = planFrom({ minX: 100, minY: -140, maxX: 220, maxY: -60 }, 12);

describe("getExperienceFraming", () => {
  test("orbits the centre of the plan footprint, not the world origin", () => {
    const framing = getExperienceFraming(lowRise);

    expect(framing.target[0]).toBeCloseTo(160);
    expect(framing.target[2]).toBeCloseTo(-100);
  });

  test("frames the whole height of a tower", () => {
    const framing = getExperienceFraming(tower);

    expect(framing.span).toBeGreaterThanOrEqual(148);
  });

  test("keeps the initial camera outside the orbit minimum distance", () => {
    for (const plan of [emptyPlan, tower, lowRise]) {
      const framing = getExperienceFraming(plan);
      const distance = Math.hypot(
        framing.cameraPosition[0] - framing.target[0],
        framing.cameraPosition[1] - framing.target[1],
        framing.cameraPosition[2] - framing.target[2],
      );

      expect(distance).toBeGreaterThan(framing.minDistance);
      expect(distance).toBeLessThan(framing.maxDistance);
    }
  });

  test("fades the ground into fog before its outer edge", () => {
    const framing = getExperienceFraming(tower);

    expect(framing.fogFar).toBeLessThanOrEqual(framing.groundSize / 2);
    expect(framing.fogNear).toBeLessThan(framing.fogFar);
  });

  test("does not let the orbit zoom out past the fog", () => {
    const framing = getExperienceFraming(tower);

    expect(framing.maxDistance).toBeLessThanOrEqual(framing.fogFar);
  });

  test("starts fog beyond the building so the model stays crisp", () => {
    const framing = getExperienceFraming(tower);

    expect(framing.fogNear).toBeGreaterThan(framing.span);
  });

  test("puts the starfield outside the model", () => {
    const framing = getExperienceFraming(tower);

    expect(framing.starRadius).toBeGreaterThan(framing.span);
  });

  test("stays finite for a plan with no walls", () => {
    const framing = getExperienceFraming(emptyPlan);

    expect(framing.span).toBeGreaterThanOrEqual(20);
    for (const value of [...framing.target, ...framing.cameraPosition, framing.fogNear, framing.fogFar]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe("getExperienceShadowRig", () => {
  test("covers the full footprint of a wide plan", () => {
    const framing = getExperienceFraming(lowRise);
    const rig = getExperienceShadowRig(framing);
    const bounds = { halfWidth: 60, halfDepth: 40 };

    expect(rig.right).toBeGreaterThanOrEqual(bounds.halfWidth);
    expect(rig.top).toBeGreaterThanOrEqual(bounds.halfDepth);
    expect(rig.left).toBe(-rig.right);
    expect(rig.bottom).toBe(-rig.top);
  });

  test("lifts the light above the ridge of a tower", () => {
    const framing = getExperienceFraming(tower);
    const rig = getExperienceShadowRig(framing);

    expect(rig.position[1]).toBeGreaterThan(148);
  });

  test("aims the shadow camera at the model centre", () => {
    const framing = getExperienceFraming(lowRise);
    const rig = getExperienceShadowRig(framing);

    expect(rig.lookAt).toEqual(framing.target);
  });

  test("reaches past the far side of the model", () => {
    const framing = getExperienceFraming(tower);
    const rig = getExperienceShadowRig(framing);
    const lightToTarget = Math.hypot(
      rig.position[0] - framing.target[0],
      rig.position[1] - framing.target[1],
      rig.position[2] - framing.target[2],
    );

    expect(rig.far).toBeGreaterThan(lightToTarget);
    expect(rig.near).toBeGreaterThan(0);
  });
});

describe("createDriftPositions", () => {
  test("spins about the building footprint, not the world origin", () => {
    const framing = getExperienceFraming(lowRise);

    expect(framing.driftOrigin).toEqual([160, 0, -100]);
  });

  test("scatters particles no further than the drift radius from the pivot", () => {
    const framing = getExperienceFraming(lowRise);
    const positions = createDriftPositions(framing, () => 1);

    for (let i = 0; i < positions.length; i += 3) {
      expect(Math.abs(positions[i])).toBeLessThanOrEqual(framing.driftRadius);
      expect(Math.abs(positions[i + 2])).toBeLessThanOrEqual(framing.driftRadius);
    }
  });

  test("fills the height of a tower", () => {
    const framing = getExperienceFraming(tower);
    const positions = createDriftPositions(framing, () => 1);
    let maxHeight = 0;
    for (let i = 1; i < positions.length; i += 3) {
      maxHeight = Math.max(maxHeight, positions[i]);
    }

    expect(maxHeight).toBeGreaterThan(148);
  });

  test("emits three finite components per particle", () => {
    const framing = getExperienceFraming(tower);
    const positions = createDriftPositions(framing);

    expect(positions.length % 3).toBe(0);
    expect(positions.length).toBeGreaterThan(0);
    expect(positions.every((value) => Number.isFinite(value))).toBe(true);
  });
});
