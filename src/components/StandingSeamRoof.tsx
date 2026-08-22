import type { Roof } from "../types/floorPlan";

interface StandingSeamRoofProps {
  roof: Roof;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  wireframe: boolean;
}

export function StandingSeamRoof({
  roof,
  minX,
  maxX,
  minZ,
  maxZ,
  wireframe,
}: StandingSeamRoofProps) {
  const overhang = roof.overhang;
  const length = maxX - minX + overhang * 2;
  const halfDepth = (maxZ - minZ) / 2 + overhang;
  const rise = roof.ridgeHeight - roof.eaveHeight;
  const slopeLen = Math.hypot(halfDepth, rise);
  const pitch = Math.atan2(rise, halfDepth);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const midY = (roof.eaveHeight + roof.ridgeHeight) / 2;
  const metal = {
    color: "#5b6570",
    roughness: 0.38,
    metalness: 0.62,
    wireframe,
  };
  const fascia = {
    color: "#3e454c",
    roughness: 0.45,
    metalness: 0.5,
    wireframe,
  };
  const seamCount = Math.max(6, Math.round(length / 0.5));

  return (
    <group>
      <RoofPlane
        position={[cx, midY, cz - halfDepth / 2]}
        rotation={[-pitch, 0, 0]}
        length={length}
        slopeLen={slopeLen}
        metal={metal}
        seamCount={seamCount}
      />
      <RoofPlane
        position={[cx, midY, cz + halfDepth / 2]}
        rotation={[pitch, 0, 0]}
        length={length}
        slopeLen={slopeLen}
        metal={metal}
        seamCount={seamCount}
      />
      <mesh
        position={[cx, roof.eaveHeight, minZ - overhang]}
        castShadow
      >
        <boxGeometry args={[length, 0.12, 0.08]} />
        <meshStandardMaterial {...fascia} />
      </mesh>
      <mesh
        position={[cx, roof.eaveHeight, maxZ + overhang]}
        castShadow
      >
        <boxGeometry args={[length, 0.12, 0.08]} />
        <meshStandardMaterial {...fascia} />
      </mesh>
    </group>
  );
}

function RoofPlane({
  position,
  rotation,
  length,
  slopeLen,
  metal,
  seamCount,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  length: number;
  slopeLen: number;
  metal: {
    color: string;
    roughness: number;
    metalness: number;
    wireframe: boolean;
  };
  seamCount: number;
}) {
  const seams = [];
  const spacing = length / seamCount;
  const start = -length / 2 + spacing / 2;
  for (let i = 0; i < seamCount; i += 1) {
    seams.push(start + i * spacing);
  }

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[length, 0.06, slopeLen]} />
        <meshStandardMaterial color={metal.color} roughness={metal.roughness} metalness={metal.metalness} wireframe={metal.wireframe} />
      </mesh>
      {seams.map((x) => (
        <mesh key={x} position={[x, 0.04, 0]} castShadow>
          <boxGeometry args={[0.03, 0.05, slopeLen]} />
          <meshStandardMaterial
            color="#6a7380"
            roughness={0.32}
            metalness={0.7}
            wireframe={metal.wireframe}
          />
        </mesh>
      ))}
    </group>
  );
}
