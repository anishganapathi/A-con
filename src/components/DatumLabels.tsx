import { Html, Line } from "@react-three/drei";
import type { ElevationDatum } from "../types/floorPlan";

interface DatumLabelsProps {
  datums: ElevationDatum[];
  origin: [number, number, number];
}

/** A datum per floor becomes an unreadable ladder on a tower. */
const MAX_DATUM_LABELS = 12;

export function DatumLabels({ datums, origin }: DatumLabelsProps) {
  const sorted = [...datums].sort((a, b) => a.elevation - b.elevation);
  const top = sorted[sorted.length - 1];
  if (!top) {
    return null;
  }
  const step = Math.max(1, Math.ceil(sorted.length / MAX_DATUM_LABELS));
  const shown = sorted.filter(
    (_, index) =>
      index % step === 0 || index === 0 || index === sorted.length - 1,
  );

  const [x, , z] = origin;
  const column: [number, number, number][] = [
    [x, 0, z],
    [x, top.elevation, z],
  ];

  return (
    <group>
      <Line points={column} color="#2c2c2c" lineWidth={1.25} />
      {shown.map((datum) => {
        const tick: [number, number, number][] = [
          [x - 0.22, datum.elevation, z],
          [x + 0.22, datum.elevation, z],
        ];
        return (
          <group key={datum.id}>
            <Line points={tick} color="#2c2c2c" lineWidth={1.25} />
            <Html
              position={[x - 0.35, datum.elevation, z]}
              center
              sprite
              distanceFactor={16}
              zIndexRange={[1, 0]}
              style={{ pointerEvents: "none" }}
            >
              <div className="datum-label">
                <span className="datum-name">{datum.name}</span>
                <span className="datum-elev">{datum.elevation.toFixed(2)} m</span>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
