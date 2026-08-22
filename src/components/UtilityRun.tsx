import { Outlines } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";
import type {
  ElectricalRun,
  PipeRun,
  RoutePoint,
} from "../types/floorPlan";
import { useEditor } from "../editor/EditorContext";
import { rotatePoint } from "../editor/floorPlanEdits";
import {
  defaultElectricalMaterial,
  defaultPipeMaterial,
  resolveMaterial,
} from "../editor/materials";
import { EditableObject } from "./EditableObject";

const UP = new Vector3(0, 1, 0);

type UtilityKind = "pipe" | "electrical";

type AnyRun = PipeRun | ElectricalRun;

interface UtilityRunProps {
  kind: UtilityKind;
  run: AnyRun;
  elevation: number;
  wireframe: boolean;
  presentation?: "plan" | "experience";
}

export function UtilityRun({
  kind,
  run,
  elevation,
  wireframe,
  presentation = "plan",
}: UtilityRunProps) {
  const { selection, select, updatePipe, updateElectrical } = useEditor();
  const selected = selection?.kind === kind && selection.id === run.id;
  const origin = routeCentroid(run.points);
  const originY =
    elevation +
    run.points.reduce((sum, point) => sum + point.height, 0) /
      Math.max(run.points.length, 1);
  const material = resolveMaterial(
    run.material,
    kind === "pipe"
      ? defaultPipeMaterial(run as PipeRun)
      : defaultElectricalMaterial(run as ElectricalRun),
  );
  const experience = presentation === "experience";

  const onSelect = (event: ThreeEvent<MouseEvent>) => {
    if (experience) {
      return;
    }
    event.stopPropagation();
    select({ kind, id: run.id });
  };

  const content = (
    <UtilityPath
      points={run.points}
      elevation={elevation}
      originX={origin.x}
      originY={originY}
      originZ={origin.y}
      radius={run.diameter / 2}
      color={material.color}
      roughness={material.roughness}
      metalness={material.metalness}
      wireframe={wireframe}
      selected={selected && !experience}
      experience={experience}
      kind={kind}
      onSelect={onSelect}
    />
  );

  if (experience) {
    return <group>{content}</group>;
  }

  return (
    <EditableObject
      selected={selected}
      origin={[origin.x, originY, origin.y]}
      onCommit={({ dx, dz, yaw }) => {
        const next = shiftRoute(run.points, dx, dz, yaw);
        if (kind === "pipe") {
          updatePipe(run.id, { points: next });
          return;
        }
        updateElectrical(run.id, { points: next });
      }}
    >
      {content}
    </EditableObject>
  );
}

function UtilityPath({
  points,
  elevation,
  originX,
  originY,
  originZ,
  radius,
  color,
  roughness,
  metalness,
  wireframe,
  selected,
  experience,
  kind,
  onSelect,
}: {
  points: RoutePoint[];
  elevation: number;
  originX: number;
  originY: number;
  originZ: number;
  radius: number;
  color: string;
  roughness: number;
  metalness: number;
  wireframe: boolean;
  selected: boolean;
  experience: boolean;
  kind: UtilityKind;
  onSelect: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const segments = useMemo(
    () => worldSegments(points, elevation),
    [points, elevation],
  );

  const hover = {
    onPointerOver: (event: ThreeEvent<PointerEvent>) => {
      if (experience) {
        return;
      }
      event.stopPropagation();
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      if (!experience) {
        document.body.style.cursor = "auto";
      }
    },
  };

  return (
    <group>
      {segments.map((segment, index) => (
        <mesh
          key={`seg-${index}`}
          position={[
            segment.mid.x - originX,
            segment.mid.y - originY,
            segment.mid.z - originZ,
          ]}
          quaternion={segment.quaternion}
          castShadow={!experience}
          onClick={onSelect}
          {...hover}
        >
          <cylinderGeometry
            args={[radius, radius, segment.length, experience ? 10 : 8]}
          />
          <meshStandardMaterial
            color={color}
            roughness={experience ? 0.25 : roughness}
            metalness={experience ? 0.55 : metalness}
            wireframe={wireframe}
            emissive={
              experience
                ? kind === "pipe"
                  ? "#4fd1c5"
                  : "#f6c453"
                : selected
                  ? "#3f5c4f"
                  : "#000000"
            }
            emissiveIntensity={
              experience ? (kind === "electrical" ? 1.35 : 0.85) : selected ? 0.2 : 0
            }
          />
          {selected ? <Outlines thickness={2.5} color="#2f4a3e" /> : null}
        </mesh>
      ))}
      {points.map((point, index) => (
        <mesh
          key={`joint-${index}`}
          position={[
            point.x - originX,
            elevation + point.height - originY,
            point.y - originZ,
          ]}
          onClick={onSelect}
          {...hover}
        >
          <sphereGeometry args={[radius * 1.35, 10, 10]} />
          <meshStandardMaterial
            color={color}
            roughness={experience ? 0.2 : roughness}
            metalness={experience ? 0.6 : metalness}
            wireframe={wireframe}
            emissive={
              experience
                ? kind === "pipe"
                  ? "#4fd1c5"
                  : "#f6c453"
                : selected
                  ? "#3f5c4f"
                  : "#000000"
            }
            emissiveIntensity={experience ? 1 : selected ? 0.2 : 0}
          />
        </mesh>
      ))}
      {kind === "electrical"
        ? [points[0], points[points.length - 1]]
            .filter((point): point is RoutePoint => Boolean(point))
            .map((point, index) => (
              <mesh
                key={`box-${index}`}
                position={[
                  point.x - originX,
                  elevation + point.height - originY,
                  point.y - originZ,
                ]}
                onClick={onSelect}
                {...hover}
              >
                <boxGeometry args={[radius * 4.2, radius * 3.4, radius * 2.6]} />
                <meshStandardMaterial
                  color={experience ? "#1a2228" : "#2b2b2b"}
                  roughness={0.55}
                  metalness={0.35}
                  emissive={experience ? "#f6c453" : "#000000"}
                  emissiveIntensity={experience ? 0.45 : 0}
                />
              </mesh>
            ))
        : null}
    </group>
  );
}

function worldSegments(points: RoutePoint[], elevation: number) {
  const segments: {
    mid: Vector3;
    length: number;
    quaternion: Quaternion;
  }[] = [];

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    if (!a || !b) {
      continue;
    }
    const from = new Vector3(a.x, elevation + a.height, a.y);
    const to = new Vector3(b.x, elevation + b.height, b.y);
    const dir = to.clone().sub(from);
    const length = dir.length();
    if (length < 0.001) {
      continue;
    }
    segments.push({
      mid: from.clone().add(to).multiplyScalar(0.5),
      length,
      quaternion: new Quaternion().setFromUnitVectors(UP, dir.normalize()),
    });
  }

  return segments;
}

function routeCentroid(points: RoutePoint[]): { x: number; y: number } {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point.x;
    y += point.y;
  }
  return { x: x / points.length, y: y / points.length };
}

function shiftRoute(
  points: RoutePoint[],
  dx: number,
  dz: number,
  yaw: number,
): RoutePoint[] {
  const moved = points.map((point) => ({
    ...point,
    x: point.x + dx,
    y: point.y + dz,
  }));
  if (Math.abs(yaw) < 0.001) {
    return moved;
  }
  const pivot = routeCentroid(moved);
  return moved.map((point) => {
    const rotated = rotatePoint({ x: point.x, y: point.y }, pivot, yaw);
    return { ...point, x: rotated.x, y: rotated.y };
  });
}
