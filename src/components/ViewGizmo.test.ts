import { describe, expect, test } from "vitest";
import { Vector3 } from "three";
import { snapPosition } from "./ViewGizmo";

// The limits Scene.tsx puts on the plan camera.
const LIMITS = { minPolarAngle: 0.12, maxPolarAngle: Math.PI / 2.08 };

describe("snapPosition", () => {
  test("keeps the distance the camera already had from the model", () => {
    const target = new Vector3(5, 4.5, 4);
    const camera = new Vector3(16, 18.1, 16.4);
    const before = camera.distanceTo(target);

    const after = snapPosition(camera, target, [0, 0, 1], LIMITS);

    expect(after.distanceTo(target)).toBeCloseTo(before, 5);
  });

  test("measures from the orbit target, not the world origin", () => {
    // drei's own gizmo measures to the origin, which on a plan centred away
    // from it throws the camera much further out than it was.
    const target = new Vector3(36, 2.7, 24);
    const camera = new Vector3(75.6, 20, 68.6);

    const after = snapPosition(camera, target, [0, 0, 1], LIMITS);

    expect(after.distanceTo(target)).toBeCloseTo(camera.distanceTo(target), 5);
    expect(after.distanceTo(target)).toBeLessThan(camera.length() - 10);
  });

  test("looks down the axis it was given", () => {
    const target = new Vector3(5, 4.5, 4);
    const camera = new Vector3(16, 18.1, 16.4);

    const east = snapPosition(camera, target, [1, 0, 0], LIMITS);
    const west = snapPosition(camera, target, [-1, 0, 0], LIMITS);

    expect(east.x).toBeGreaterThan(target.x);
    expect(west.x).toBeLessThan(target.x);
    expect(east.z).toBeCloseTo(target.z, 5);
  });

  test("holds the top view inside the polar limit rather than going vertical", () => {
    const target = new Vector3(5, 4.5, 4);
    const camera = new Vector3(16, 18.1, 16.4);

    const top = snapPosition(camera, target, [0, 1, 0], LIMITS);
    const offset = top.clone().sub(target);
    const polar = Math.acos(offset.y / offset.length());

    expect(polar).toBeGreaterThanOrEqual(LIMITS.minPolarAngle);
    expect(top.y).toBeGreaterThan(target.y);
  });

  test("never drops the camera below the ground plane", () => {
    const target = new Vector3(5, 4.5, 4);
    const camera = new Vector3(16, 18.1, 16.4);

    for (const direction of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, 1],
      [0, 0, -1],
      [0, 1, 0],
    ] as [number, number, number][]) {
      const landed = snapPosition(camera, target, direction, LIMITS);
      const offset = landed.clone().sub(target);
      const polar = Math.acos(offset.y / offset.length());

      expect(polar).toBeLessThanOrEqual(LIMITS.maxPolarAngle);
    }
  });
});
