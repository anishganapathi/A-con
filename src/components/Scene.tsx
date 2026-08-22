import { useMemo } from "react";
import { ContactShadows, OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useEditor } from "../editor/EditorContext";
import type { ViewOptions } from "../types/floorPlan";
import { BuildingModel, getPlanBounds } from "./FloorPlanModel";

interface SceneProps {
  options: ViewOptions;
}

export function Scene({ options }: SceneProps) {
  const { floorPlan, select } = useEditor();
  const bounds = getPlanBounds(floorPlan);
  const ridge = floorPlan.roof.ridgeHeight;
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 20);
  const target = useMemo<[number, number, number]>(
    () => [bounds.centerX, ridge * 0.38, bounds.centerZ],
    [bounds.centerX, bounds.centerZ, ridge],
  );

  if (floorPlan.floors.length === 0) {
    return (
      <div className="scene-empty">No floor data in this floor plan.</div>
    );
  }

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true }}
      className="scene-canvas"
      onPointerMissed={() => select(null)}
    >
      <color attach="background" args={["#d4dde6"]} />
      <ViewCamera is2D={options.is2D} target={target} ridge={ridge} span={span} />
      <Lights span={span} />
      <OrbitControls
        key={options.is2D ? "ortho" : "persp"}
        makeDefault
        target={target}
        enableDamping
        dampingFactor={0.08}
        enableRotate={!options.is2D}
        minPolarAngle={options.is2D ? 0 : 0.12}
        maxPolarAngle={options.is2D ? 0 : Math.PI / 2.08}
        minDistance={4}
        maxDistance={Math.max(400, span * 12)}
      />
      <BuildingModel plan={floorPlan} options={options} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[target[0], -0.04, target[2]]}
        receiveShadow
        onClick={(event) => {
          event.stopPropagation();
          select(null);
        }}
      >
        <planeGeometry args={[Math.max(400, span * 16), Math.max(400, span * 16)]} />
        <meshStandardMaterial color="#d4dde6" roughness={1} metalness={0} />
      </mesh>
      <ContactShadows
        position={[bounds.centerX, 0.01, bounds.centerZ]}
        opacity={0.35}
        scale={Math.max(32, span * 1.4)}
        blur={2.2}
        far={14}
      />
    </Canvas>
  );
}

function Lights({ span }: { span: number }) {
  const reach = Math.max(40, span * 1.2);
  return (
    <>
      <ambientLight intensity={0.4} />
      <hemisphereLight args={["#eef3f8", "#b9a894", 0.5]} />
      <directionalLight
        castShadow
        position={[span * 0.45, Math.max(22, span * 0.55), span * 0.3]}
        intensity={1.45}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={Math.max(80, span * 3)}
        shadow-camera-left={-reach}
        shadow-camera-right={reach}
        shadow-camera-top={reach}
        shadow-camera-bottom={-reach}
        shadow-bias={-0.00025}
      />
    </>
  );
}

interface ViewCameraProps {
  is2D: boolean;
  target: [number, number, number];
  ridge: number;
  span: number;
}

function ViewCamera({ is2D, target, ridge, span }: ViewCameraProps) {
  if (is2D) {
    return (
      <OrthographicCamera
        key="ortho-cam"
        makeDefault
        position={[target[0], Math.max(22, ridge + 10), target[2]]}
        zoom={Math.max(8, 420 / span)}
        near={0.1}
        far={Math.max(2000, span * 40)}
      />
    );
  }

  return (
    <PerspectiveCamera
      key={`persp-${Math.round(span)}`}
      makeDefault
      position={[
        target[0] + span * 0.55,
        Math.max(ridge * 0.85 + 8, span * 0.28),
        target[2] + span * 0.62,
      ]}
      fov={38}
      near={0.1}
      far={Math.max(2000, span * 40)}
    />
  );
}
