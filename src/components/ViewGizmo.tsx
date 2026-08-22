import { GizmoHelper } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useMemo, useRef, useState } from "react";
import { CanvasTexture, Spherical, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

/**
 * The chat panel is 340px wide with a 20px gutter, so the gizmo is pushed far
 * enough in from the right edge to sit beside it rather than underneath it.
 */
const CHAT_CLEARANCE = 440;

/**
 * Everything inside the gizmo is in pixels once scaled by this. Heads sit one
 * unit out, so the widget spans roughly two and a half of these across.
 */
const GIZMO_SCALE = 44;

interface AxisSpec {
  id: string;
  label: string;
  direction: [number, number, number];
  color: string;
}

/**
 * No -Y head: the camera is fenced above the ground plane, so a view from
 * underneath is one OrbitControls would only clamp back out again.
 */
const AXES: AxisSpec[] = [
  { id: "x", label: "X", direction: [1, 0, 0], color: "#d1544c" },
  { id: "y", label: "Y", direction: [0, 1, 0], color: "#5c9e63" },
  { id: "z", label: "Z", direction: [0, 0, 1], color: "#3f7bd4" },
  { id: "-x", label: "", direction: [-1, 0, 0], color: "#d1544c" },
  { id: "-z", label: "", direction: [0, 0, -1], color: "#3f7bd4" },
];

/**
 * The Blender-style axis widget. Clicking a head glides the camera down that
 * axis, keeping the distance it already had from the model.
 *
 * The camera and controls are read here rather than in the children: those
 * render inside GizmoHelper's Hud portal, where `state.camera` is the gizmo's
 * own orthographic camera instead of the one framing the building.
 *
 * drei's GizmoViewport is not used for the snap either, because it measures the
 * camera distance to the world origin rather than to the orbit target, so on a
 * plan whose centre sits away from the origin — every building compiled from a
 * drawing — clicking an axis throws the camera much further out than it was.
 */
export function ViewGizmo({ enabled }: { enabled: boolean }) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as OrbitControlsImpl | null;
  const goal = useRef<Vector3 | null>(null);

  useFrame(() => {
    const destination = goal.current;
    if (!destination || !controls) {
      return;
    }
    camera.position.lerp(destination, 0.16);
    controls.update();
    if (camera.position.distanceTo(destination) < 0.05) {
      camera.position.copy(destination);
      controls.update();
      goal.current = null;
    }
  });

  const snapTo = useCallback(
    (direction: [number, number, number]) => {
      if (!controls) {
        return;
      }
      goal.current = snapPosition(camera.position, controls.target, direction, {
        minPolarAngle: controls.minPolarAngle,
        maxPolarAngle: controls.maxPolarAngle,
      });
    },
    [camera, controls],
  );

  if (!enabled) {
    return null;
  }
  return (
    <GizmoHelper alignment="top-right" margin={[CHAT_CLEARANCE, 100]}>
      <group scale={GIZMO_SCALE}>
        <Axes />
        {AXES.map((axis) => (
          <AxisHead key={axis.id} axis={axis} onSelect={snapTo} />
        ))}
      </group>
    </GizmoHelper>
  );
}

/**
 * Where the camera lands when an axis is picked: down that axis from the orbit
 * target, still the distance out it already was, and inside the polar limits
 * the controls enforce so the glide is never fighting a clamp.
 */
export function snapPosition(
  cameraPosition: Vector3,
  target: Vector3,
  direction: [number, number, number],
  limits: { minPolarAngle: number; maxPolarAngle: number },
): Vector3 {
  const spherical = new Spherical().setFromVector3(new Vector3(...direction));
  spherical.radius = cameraPosition.distanceTo(target);
  spherical.phi = Math.min(
    Math.max(spherical.phi, limits.minPolarAngle + 0.01),
    limits.maxPolarAngle - 0.01,
  );
  return new Vector3().setFromSpherical(spherical).add(target);
}

function Axes() {
  return (
    <>
      {AXES.filter((axis) => axis.label).map((axis) => (
        <mesh
          key={axis.id}
          position={axis.direction.map((value) => value * 0.4) as [number, number, number]}
        >
          <boxGeometry
            args={
              axis.id === "x"
                ? [0.8, 0.055, 0.055]
                : axis.id === "y"
                  ? [0.055, 0.8, 0.055]
                  : [0.055, 0.055, 0.8]
            }
          />
          <meshBasicMaterial color={axis.color} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

function AxisHead({
  axis,
  onSelect,
}: {
  axis: AxisSpec;
  onSelect: (direction: [number, number, number]) => void;
}) {
  const [hovered, setHovered] = useState(false);
  // Drawn to a canvas rather than typeset, so the gizmo needs no font at runtime.
  const texture = useMemo(() => headTexture(axis), [axis]);
  // Sprite scale is in the group's units, so 1 is a head the width of the
  // whole gizmo scale — the same proportion drei's own viewport uses.
  const scale = (axis.label ? 1 : 0.8) * (hovered ? 1.15 : 1);

  return (
    <sprite
      position={axis.direction as [number, number, number]}
      scale={scale}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect(axis.direction);
      }}
    >
      <spriteMaterial map={texture} alphaTest={0.3} toneMapped={false} />
    </sprite>
  );
}

function headTexture(axis: AxisSpec): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) {
    return new CanvasTexture(canvas);
  }
  context.beginPath();
  context.arc(32, 32, 18, 0, 2 * Math.PI);
  context.closePath();
  if (axis.label) {
    context.fillStyle = axis.color;
    context.fill();
    context.font = "bold 21px Inter var, Arial, sans-serif";
    context.textAlign = "center";
    context.fillStyle = "#f7fafc";
    context.fillText(axis.label, 32, 41);
  } else {
    // The far side of each axis reads as an outline, the way Blender draws it.
    context.fillStyle = "rgba(255, 255, 255, 0.9)";
    context.fill();
    context.lineWidth = 5;
    context.strokeStyle = axis.color;
    context.stroke();
  }
  return new CanvasTexture(canvas);
}
