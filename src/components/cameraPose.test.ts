import { afterEach, describe, expect, test } from "vitest";
import {
  clearCameraPose,
  initialView,
  persistOrbit,
  rememberCameraPose,
} from "./cameraPose";

const planView = {
  position: [40, 18, 32] as [number, number, number],
  target: [8, 6, 4] as [number, number, number],
};

const experienceView = {
  position: [12, 9, 20] as [number, number, number],
  target: [1, 5, 2] as [number, number, number],
};

afterEach(() => {
  clearCameraPose();
});

describe("camera pose across plan and experience", () => {
  test("starts each mode from its own default framing", () => {
    expect(initialView(planView)).toEqual(planView);
    expect(initialView(experienceView)).toEqual(experienceView);
  });

  test("keeps the same camera when switching plan → experience and back", () => {
    persistOrbit({
      object: { position: { x: 22, y: 14, z: 31 } },
      target: { x: 7, y: 4, z: 3 },
    });

    expect(initialView(experienceView)).toEqual({
      position: [22, 14, 31],
      target: [7, 4, 3],
    });

    persistOrbit({
      object: { position: { x: 22, y: 14, z: 31 } },
      target: { x: 7, y: 4, z: 3 },
    });

    expect(initialView(planView)).toEqual({
      position: [22, 14, 31],
      target: [7, 4, 3],
    });
  });

  test("copies the saved pose so later orbit updates do not mutate a live view", () => {
    rememberCameraPose({
      position: [1, 2, 3],
      target: [4, 5, 6],
    });

    const view = initialView(planView);
    view.position[0] = 99;
    view.target[1] = 99;

    expect(initialView(planView)).toEqual({
      position: [1, 2, 3],
      target: [4, 5, 6],
    });
  });
});
