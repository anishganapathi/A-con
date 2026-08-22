import { Outlines } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { Opening, Wall as WallData, WallSegment } from "../types/floorPlan";
import { useEditor } from "../editor/EditorContext";
import { rotatePoint } from "../editor/floorPlanEdits";
import {
  defaultOpeningMaterial,
  defaultWallMaterial,
  resolveMaterial,
} from "../editor/materials";
import { EditableObject } from "./EditableObject";

interface WallProps {
  wall: WallData;
  segments: WallSegment[];
  openings: Opening[];
  elevation: number;
  wireframe: boolean;
}

export function Wall({
  wall,
  segments,
  openings,
  elevation,
  wireframe,
}: WallProps) {
  const { selection, select, updateWall } = useEditor();
  const selected = selection?.kind === "wall" && selection.id === wall.id;
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.y - wall.start.y;
  const length = Math.hypot(dx, dz);
  const dirX = length === 0 ? 1 : dx / length;
  const dirZ = length === 0 ? 0 : dz / length;
  const rotationY = Math.atan2(-dz, dx);
  const material = resolveMaterial(wall.material, defaultWallMaterial(wall));
  const originX = (wall.start.x + wall.end.x) / 2;
  const originZ = (wall.start.y + wall.end.y) / 2;

  const onSelectWall = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    select({ kind: "wall", id: wall.id });
  };

  return (
    <EditableObject
      selected={selected}
      origin={[originX, 0, originZ]}
      onCommit={({ dx: moveX, dz: moveZ, yaw }) => {
        let start = {
          x: wall.start.x + moveX,
          y: wall.start.y + moveZ,
        };
        let end = {
          x: wall.end.x + moveX,
          y: wall.end.y + moveZ,
        };
        if (Math.abs(yaw) > 0.001) {
          const pivot = {
            x: (start.x + end.x) / 2,
            y: (start.y + end.y) / 2,
          };
          start = rotatePoint(start, pivot, yaw);
          end = rotatePoint(end, pivot, yaw);
        }
        updateWall(wall.id, { start, end });
      }}
    >
      {segments.map((segment, index) => {
        const segLength = segment.endOffset - segment.startOffset;
        const height = segment.top - segment.bottom;
        if (segLength < 0.001 || height < 0.001) {
          return null;
        }
        const mid = (segment.startOffset + segment.endOffset) / 2;
        const worldX = wall.start.x + dirX * mid;
        const worldZ = wall.start.y + dirZ * mid;
        return (
          <mesh
            key={`${wall.id}-seg-${index}`}
            castShadow
            receiveShadow
            position={[
              worldX - originX,
              elevation + (segment.bottom + segment.top) / 2,
              worldZ - originZ,
            ]}
            rotation={[0, rotationY, 0]}
            onClick={onSelectWall}
            onPointerOver={setPointerCursor}
            onPointerOut={clearPointerCursor}
          >
            <boxGeometry args={[segLength, height, wall.thickness]} />
            <meshStandardMaterial
              color={material.color}
              roughness={material.roughness}
              metalness={material.metalness}
              wireframe={wireframe}
              emissive={selected ? "#3f5c4f" : "#000000"}
              emissiveIntensity={selected ? 0.18 : 0}
            />
            {selected ? <Outlines thickness={3.5} color="#2f4a3e" /> : null}
          </mesh>
        );
      })}
      {openings.map((opening) => (
        <OpeningFill
          key={opening.id}
          wall={wall}
          opening={opening}
          originX={originX}
          originZ={originZ}
          dirX={dirX}
          dirZ={dirZ}
          rotationY={rotationY}
          elevation={elevation}
          wireframe={wireframe}
        />
      ))}
    </EditableObject>
  );
}

interface OpeningFillProps {
  wall: WallData;
  opening: Opening;
  originX: number;
  originZ: number;
  dirX: number;
  dirZ: number;
  rotationY: number;
  elevation: number;
  wireframe: boolean;
}

function OpeningFill({
  wall,
  opening,
  originX,
  originZ,
  dirX,
  dirZ,
  rotationY,
  elevation,
  wireframe,
}: OpeningFillProps) {
  const { selection, select } = useEditor();
  const selected = selection?.kind === "opening" && selection.id === opening.id;
  const material = resolveMaterial(
    opening.material,
    defaultOpeningMaterial(opening),
  );
  const mid = opening.offsetFromStart + opening.width / 2;
  const y = elevation + opening.sillHeight + opening.height / 2;
  const x = wall.start.x + dirX * mid - originX;
  const z = wall.start.y + dirZ * mid - originZ;
  const isWindow = opening.type === "window";

  return (
    <group
      position={[x, y, z]}
      rotation={[0, rotationY, 0]}
      onClick={(event) => {
        event.stopPropagation();
        select({ kind: "opening", id: opening.id });
      }}
      onPointerOver={setPointerCursor}
      onPointerOut={clearPointerCursor}
    >
      <mesh castShadow={!isWindow}>
        <boxGeometry
          args={[
            opening.width - 0.1,
            opening.height - 0.1,
            wall.thickness * (isWindow ? 0.1 : 0.14),
          ]}
        />
        <meshStandardMaterial
          color={material.color}
          roughness={material.roughness}
          metalness={material.metalness}
          transparent={isWindow}
          opacity={material.opacity ?? (isWindow ? 0.28 : 0.92)}
          wireframe={wireframe}
          emissive={selected ? "#3f5c4f" : "#000000"}
          emissiveIntensity={selected ? 0.2 : 0}
        />
        {selected ? <Outlines thickness={3.5} color="#2f4a3e" /> : null}
      </mesh>
      <OpeningFrame
        width={opening.width}
        height={opening.height}
        depth={wall.thickness * 0.62}
        wireframe={wireframe}
        selected={selected}
      />
      {isWindow && opening.width > 1.15 ? (
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.045, opening.height - 0.12, wall.thickness * 0.4]} />
          <meshStandardMaterial
            color="#4f4c48"
            roughness={0.55}
            metalness={0.18}
            wireframe={wireframe}
          />
        </mesh>
      ) : null}
      {isWindow && opening.height > 1.8 ? (
        <mesh position={[0, 0, 0]} castShadow>
          <boxGeometry args={[opening.width - 0.12, 0.045, wall.thickness * 0.4]} />
          <meshStandardMaterial
            color="#4f4c48"
            roughness={0.55}
            metalness={0.18}
            wireframe={wireframe}
          />
        </mesh>
      ) : null}
    </group>
  );
}

function OpeningFrame({
  width,
  height,
  depth,
  wireframe,
  selected,
}: {
  width: number;
  height: number;
  depth: number;
  wireframe: boolean;
  selected: boolean;
}) {
  const t = 0.055;
  const color = selected ? "#3f5c4f" : "#4a4743";
  return (
    <group>
      <mesh position={[-(width / 2) + t / 2, 0, 0]} castShadow>
        <boxGeometry args={[t, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.12} wireframe={wireframe} />
      </mesh>
      <mesh position={[width / 2 - t / 2, 0, 0]} castShadow>
        <boxGeometry args={[t, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.12} wireframe={wireframe} />
      </mesh>
      <mesh position={[0, height / 2 - t / 2, 0]} castShadow>
        <boxGeometry args={[width, t, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.12} wireframe={wireframe} />
      </mesh>
      <mesh position={[0, -(height / 2) + t / 2, 0]} castShadow>
        <boxGeometry args={[width, t, depth]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.12} wireframe={wireframe} />
      </mesh>
    </group>
  );
}

function setPointerCursor(event: ThreeEvent<PointerEvent>) {
  event.stopPropagation();
  document.body.style.cursor = "pointer";
}

function clearPointerCursor() {
  document.body.style.cursor = "auto";
}
