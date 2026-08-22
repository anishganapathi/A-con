import { Html, Line } from "@react-three/drei";
import type { Dimension } from "../types/floorPlan";

interface DimensionLabelProps {
  dimension: Dimension;
  elevation: number;
}

const TICK = 0.16;
const LINE_Y = 0.08;

export function DimensionLabel({ dimension, elevation }: DimensionLabelProps) {
  const y = elevation + LINE_Y;
  const dx = dimension.to.x - dimension.from.x;
  const dz = dimension.to.y - dimension.from.y;
  const length = Math.hypot(dx, dz) || 1;
  const nx = (-dz / length) * TICK;
  const nz = (dx / length) * TICK;

  const from: [number, number, number] = [
    dimension.from.x,
    y,
    dimension.from.y,
  ];
  const to: [number, number, number] = [dimension.to.x, y, dimension.to.y];
  const mid: [number, number, number] = [
    (dimension.from.x + dimension.to.x) / 2,
    y + 0.02,
    (dimension.from.y + dimension.to.y) / 2,
  ];

  const fromTickA: [number, number, number] = [
    from[0] - nx,
    y,
    from[2] - nz,
  ];
  const fromTickB: [number, number, number] = [
    from[0] + nx,
    y,
    from[2] + nz,
  ];
  const toTickA: [number, number, number] = [to[0] - nx, y, to[2] - nz];
  const toTickB: [number, number, number] = [to[0] + nx, y, to[2] + nz];

  return (
    <group>
      <Line points={[from, to]} color="#3a3a3a" lineWidth={1.5} />
      <Line points={[fromTickA, fromTickB]} color="#3a3a3a" lineWidth={1.5} />
      <Line points={[toTickA, toTickB]} color="#3a3a3a" lineWidth={1.5} />
      <Html
        position={mid}
        center
        sprite
        distanceFactor={12}
        zIndexRange={[1, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div className="dim-label">{dimension.label}</div>
      </Html>
    </group>
  );
}
