import { useMemo, useRef } from "react";
import { Grid, OrbitControls, PerspectiveCamera, Stars } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Bloom,
  EffectComposer,
  Vignette,
} from "@react-three/postprocessing";
import type { Group } from "three";
import { useEditor } from "../editor/EditorContext";
import { ExperienceBuilding } from "./ExperienceBuilding";
import { getPlanBounds } from "./FloorPlanModel";

export function ExperienceScene() {
  const { floorPlan } = useEditor();
  const bounds = getPlanBounds(floorPlan);
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 20);
  const target: [number, number, number] = [
    bounds.centerX,
    floorPlan.roof.ridgeHeight * 0.42,
    bounds.centerZ,
  ];

  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      gl={{ antialias: true, toneMappingExposure: 1.15 }}
      className="scene-canvas experience-canvas"
    >
      <color attach="background" args={["#05080c"]} />
      <fog attach="fog" args={["#071018", span * 6, span * 18]} />
      <PerspectiveCamera
        makeDefault
        position={[target[0] + span * 0.45, Math.max(14, span * 0.28), target[2] + span * 0.5]}
        fov={36}
        near={0.1}
        far={Math.max(2000, span * 40)}
      />
      <OrbitControls
        makeDefault
        target={target}
        enableDamping
        dampingFactor={0.06}
        autoRotate
        autoRotateSpeed={0.35}
        minDistance={10}
        maxDistance={Math.max(400, span * 12)}
        maxPolarAngle={Math.PI / 2.08}
      />
      <ExperienceLights />
      <Stars radius={90} depth={40} count={1800} factor={2.6} saturation={0} fade speed={0.4} />
      <Grid
        position={[target[0], -0.02, target[2]]}
        args={[span * 2.4, span * 2.4]}
        cellSize={2}
        cellThickness={0.6}
        cellColor="#1c3a3a"
        sectionSize={10}
        sectionThickness={1.1}
        sectionColor="#2d6b66"
        fadeDistance={Math.max(160, span * 8)}
        fadeStrength={1.4}
        infiniteGrid
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[target[0], -0.04, target[2]]}
        receiveShadow
      >
        <planeGeometry args={[Math.max(400, span * 16), Math.max(400, span * 16)]} />
        <meshStandardMaterial color="#070c10" roughness={1} metalness={0.1} />
      </mesh>
      <ExperienceBuilding plan={floorPlan} />
      <DriftField />
      <EffectComposer>
        <Bloom
          intensity={0.85}
          luminanceThreshold={0.18}
          luminanceSmoothing={0.35}
          mipmapBlur
        />
        <Vignette eskil={false} offset={0.22} darkness={0.72} />
      </EffectComposer>
    </Canvas>
  );
}

function ExperienceLights() {
  return (
    <>
      <ambientLight intensity={0.18} />
      <hemisphereLight args={["#7ee0d6", "#0a0e12", 0.28]} />
      <directionalLight
        castShadow
        position={[18, 24, 8]}
        intensity={1.1}
        color="#cfe8e4"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={2}
        shadow-camera-far={70}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <pointLight position={[6, 8, 4]} intensity={12} color="#5eead4" distance={28} />
      <pointLight position={[2, 3, 10]} intensity={6} color="#7aa2ff" distance={22} />
    </>
  );
}

function DriftField() {
  const group = useRef<Group>(null);
  const positions = useMemo(() => {
    const count = 90;
    const data = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      data[i * 3] = (Math.random() - 0.5) * 40;
      data[i * 3 + 1] = Math.random() * 16;
      data[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    return data;
  }, []);

  useFrame((_, delta) => {
    if (!group.current) {
      return;
    }
    group.current.rotation.y += delta * 0.03;
  });

  return (
    <group ref={group}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#7ee0d6"
          size={0.06}
          sizeAttenuation
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </points>
    </group>
  );
}
