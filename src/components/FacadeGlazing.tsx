import { useLayoutEffect, useMemo, useRef } from "react";
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";
import type { Floor } from "../types/floorPlan";

/**
 * Towers are glazed with an instanced grid rather than modelled openings.
 * A punched opening splits its wall into three meshes and adds a frame, which
 * is right when you can see the reveal but costs tens of thousands of meshes
 * across a hundred storeys. These panes are one draw call for the whole
 * building, and at facade scale they read the same.
 */

/** Bay spacing: one window plus the pier beside it. */
const BAY = 1.7;
const PANE_FRACTION = 0.62;
const SILL = 0.95;
const MAX_PANE_HEIGHT = 1.8;
/** Panes span the full wall thickness so they show inside and out. */
const PROUD = 0.05;

interface FacadeGlazingProps {
  floors: Floor[];
  wireframe: boolean;
}

export function FacadeGlazing({ floors, wireframe }: FacadeGlazingProps) {
  const panes = useMemo(() => buildPanes(floors), [floors]);
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) {
      return;
    }
    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    const axis = new Vector3(0, 1, 0);
    panes.forEach((pane, index) => {
      position.set(pane.x, pane.y, pane.z);
      quaternion.setFromAxisAngle(axis, pane.rotY);
      scale.set(pane.width, pane.height, pane.depth);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.count = panes.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [panes]);

  if (panes.length === 0) {
    return null;
  }

  return (
    <instancedMesh
      key={panes.length}
      ref={ref}
      args={[undefined, undefined, panes.length]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="#2b3138"
        roughness={0.22}
        metalness={0.55}
        wireframe={wireframe}
      />
    </instancedMesh>
  );
}

interface Pane {
  x: number;
  y: number;
  z: number;
  rotY: number;
  width: number;
  height: number;
  depth: number;
}

function buildPanes(floors: Floor[]): Pane[] {
  const panes: Pane[] = [];
  for (const floor of floors) {
    // A floor that already carries modelled openings is glazed properly and
    // must not be doubled up on. Crown and mast levels carry no windows.
    if (floor.openings.length > 0 || floor.occupiable === false) {
      continue;
    }
    for (const wall of floor.walls) {
      if (wall.type !== "exterior") {
        continue;
      }
      const dx = wall.end.x - wall.start.x;
      const dz = wall.end.y - wall.start.y;
      const length = Math.hypot(dx, dz);
      const bays = Math.floor(length / BAY);
      if (bays < 1) {
        continue;
      }
      const height = Math.min(MAX_PANE_HEIGHT, wall.height - 1.5);
      if (height < 0.5) {
        continue;
      }
      const dirX = dx / length;
      const dirZ = dz / length;
      const rotY = Math.atan2(-dz, dx);
      const margin = (length - bays * BAY) / 2;
      const y = floor.elevation + SILL + height / 2;
      for (let i = 0; i < bays; i += 1) {
        const along = margin + BAY * (i + 0.5);
        panes.push({
          x: wall.start.x + dirX * along,
          y,
          z: wall.start.y + dirZ * along,
          rotY,
          width: BAY * PANE_FRACTION,
          height,
          depth: wall.thickness + PROUD,
        });
      }
    }
  }
  return panes;
}
