import { useEffect, useMemo, useRef } from "react";
import { Grid, PerspectiveCamera, Stars } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Bloom,
  EffectComposer,
  Vignette,
} from "@react-three/postprocessing";
import type { DirectionalLight, Group } from "three";
import { useEditor } from "../editor/EditorContext";
import { ExperienceBuilding } from "./ExperienceBuilding";
import { peekCameraPose } from "./cameraPose";
import { PersistedOrbitControls, usePersistedView } from "./PersistedOrbitControls";
import {
  createDriftPositions,
  getExperienceFraming,
  getExperienceShadowRig,
  type ExperienceFraming,
} from "./experienceFraming";

export function ExperienceScene() {
  const { floorPlan } = useEditor();
  const framing = useMemo(() => getExperienceFraming(floorPlan), [floorPlan]);
  const { span, target } = framing;
  const fallback = useMemo(
    () => ({ position: framing.cameraPosition, target: framing.target }),
    [framing],
  );
  const view = usePersistedView(fallback);
  const holdView = useRef(peekCameraPose() !== null).current;

  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      gl={{ antialias: true, toneMappingExposure: 1.15 }}
      className="scene-canvas experience-canvas"
    >
      <color attach="background" args={["#05080c"]} />
      <fog attach="fog" args={["#071018", framing.fogNear, framing.fogFar]} />
      <PerspectiveCamera
        key={`persp-${Math.round(span)}`}
        makeDefault
        position={view.position}
        fov={36}
        near={0.1}
        far={framing.cameraFar}
      />
      <PersistedOrbitControls
        fallback={fallback}
        makeDefault
        enableDamping
        dampingFactor={0.06}
        autoRotate={!holdView}
        autoRotateSpeed={0.35}
        minDistance={framing.minDistance}
        maxDistance={framing.maxDistance}
        maxPolarAngle={Math.PI / 2.08}
      />
      <ExperienceLights framing={framing} />
      <group position={[target[0], 0, target[2]]}>
        <Stars
          radius={framing.starRadius}
          depth={framing.starDepth}
          count={1800}
          factor={2.6}
          saturation={0}
          fade
          speed={0.4}
        />
      </group>
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
        <planeGeometry args={[framing.groundSize, framing.groundSize]} />
        <meshStandardMaterial color="#070c10" roughness={1} metalness={0.1} />
      </mesh>
      <ExperienceBuilding plan={floorPlan} />
      <DriftField framing={framing} />
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

function ExperienceLights({ framing }: { framing: ExperienceFraming }) {
  const rig = useMemo(() => getExperienceShadowRig(framing), [framing]);
  const sun = useRef<DirectionalLight>(null);
  const { span, target } = framing;

  useEffect(() => {
    if (!sun.current) {
      return;
    }
    // The shadow frustum is built around light.target, which lives outside the
    // scene graph and so has to be positioned and flushed by hand.
    sun.current.target.position.set(...rig.lookAt);
    sun.current.target.updateMatrixWorld();
  }, [rig.lookAt]);

  return (
    <>
      <ambientLight intensity={0.18} />
      <hemisphereLight args={["#7ee0d6", "#0a0e12", 0.28]} />
      <directionalLight
        ref={sun}
        castShadow
        position={rig.position}
        intensity={1.1}
        color="#cfe8e4"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={rig.near}
        shadow-camera-far={rig.far}
        shadow-camera-left={rig.left}
        shadow-camera-right={rig.right}
        shadow-camera-top={rig.top}
        shadow-camera-bottom={rig.bottom}
        shadow-bias={-0.00025}
      />
      <pointLight
        position={[target[0] + span * 0.3, span * 0.4, target[2] + span * 0.2]}
        intensity={12}
        color="#5eead4"
        distance={span * 1.4}
      />
      <pointLight
        position={[target[0] + span * 0.1, span * 0.15, target[2] + span * 0.5]}
        intensity={6}
        color="#7aa2ff"
        distance={span * 1.1}
      />
    </>
  );
}

function DriftField({ framing }: { framing: ExperienceFraming }) {
  const group = useRef<Group>(null);
  const positions = useMemo(() => createDriftPositions(framing), [framing]);

  useFrame((_, delta) => {
    if (!group.current) {
      return;
    }
    group.current.rotation.y += delta * 0.03;
  });

  return (
    <group ref={group} position={framing.driftOrigin}>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#7ee0d6"
          size={Math.max(0.06, framing.span * 0.003)}
          sizeAttenuation
          transparent
          opacity={0.55}
          depthWrite={false}
        />
      </points>
    </group>
  );
}
