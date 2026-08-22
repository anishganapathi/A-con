import type { FloorPlan } from "../types/floorPlan";
import { getPlanBounds } from "./FloorPlanModel";

export interface ExperienceFraming {
  span: number;
  target: [number, number, number];
  cameraPosition: [number, number, number];
  cameraFar: number;
  minDistance: number;
  maxDistance: number;
  fogNear: number;
  fogFar: number;
  groundSize: number;
  starRadius: number;
  starDepth: number;
  /** Pivot the drift field spins around, at ground level under the model. */
  driftOrigin: [number, number, number];
  driftCount: number;
  driftRadius: number;
  driftHeight: number;
}

export interface ExperienceShadowRig {
  position: [number, number, number];
  lookAt: [number, number, number];
  near: number;
  far: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Every distance in the experience scene derives from `span`, the largest extent
 * of the model. Agent-authored plans range from a 20 m cottage to a 150 m tower,
 * so nothing here may be a fixed world-space constant.
 */
export function getExperienceFraming(plan: FloorPlan): ExperienceFraming {
  const bounds = getPlanBounds(plan);
  const ridge = Math.max(0, plan.roof.ridgeHeight);
  const plateSpan = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 20);
  const span = Math.max(plateSpan, ridge);
  const target: [number, number, number] = [bounds.centerX, ridge * 0.42, bounds.centerZ];
  const groundSize = Math.max(400, span * 16);
  const fogNear = span * 2.5;
  const fogFar = groundSize / 2;

  return {
    span,
    target,
    cameraPosition: [
      target[0] + span * 0.45,
      Math.max(14, span * 0.28),
      target[2] + span * 0.5,
    ],
    cameraFar: Math.max(2000, span * 40),
    minDistance: 10,
    maxDistance: Math.min(Math.max(400, span * 12), fogFar),
    fogNear,
    fogFar,
    groundSize,
    starRadius: Math.max(120, span * 3),
    starDepth: Math.max(40, span),
    driftOrigin: [target[0], 0, target[2]],
    driftCount: 90,
    driftRadius: span * 0.9,
    driftHeight: span * 1.05,
  };
}

export function getExperienceShadowRig(framing: ExperienceFraming): ExperienceShadowRig {
  const { span, target } = framing;
  // Half-extent of the shadow frustum, which is square and centred on the model.
  const reach = Math.max(40, span * 0.9);
  const position: [number, number, number] = [
    target[0] + span * 0.6,
    target[1] + span * 0.9,
    target[2] + span * 0.45,
  ];

  return {
    position,
    lookAt: target,
    near: 1,
    far: Math.max(80, span * 3),
    left: -reach,
    right: reach,
    top: reach,
    bottom: -reach,
  };
}

export function createDriftPositions(
  framing: ExperienceFraming,
  random: () => number = Math.random,
): Float32Array {
  const { driftCount, driftRadius, driftHeight } = framing;
  const data = new Float32Array(driftCount * 3);
  // Local to `driftOrigin` so the field can spin around the model.
  for (let i = 0; i < driftCount; i += 1) {
    data[i * 3] = (random() - 0.5) * 2 * driftRadius;
    data[i * 3 + 1] = random() * driftHeight;
    data[i * 3 + 2] = (random() - 0.5) * 2 * driftRadius;
  }
  return data;
}
