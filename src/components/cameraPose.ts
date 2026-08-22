export type Vec3 = [number, number, number];

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

interface OrbitSnapshot {
  object: { position: { x: number; y: number; z: number } };
  target: { x: number; y: number; z: number };
}

let pose: CameraPose | null = null;

function copyPose(next: CameraPose): CameraPose {
  return {
    position: [next.position[0], next.position[1], next.position[2]],
    target: [next.target[0], next.target[1], next.target[2]],
  };
}

export function rememberCameraPose(next: CameraPose) {
  pose = copyPose(next);
}

export function persistOrbit(controls: OrbitSnapshot) {
  const { x, y, z } = controls.object.position;
  const target = controls.target;
  rememberCameraPose({
    position: [x, y, z],
    target: [target.x, target.y, target.z],
  });
}

export function peekCameraPose(): CameraPose | null {
  return pose ? copyPose(pose) : null;
}

export function initialView(fallback: CameraPose): CameraPose {
  return peekCameraPose() ?? copyPose(fallback);
}

export function clearCameraPose() {
  pose = null;
}
