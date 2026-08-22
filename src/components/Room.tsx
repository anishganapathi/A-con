import { useEffect, useMemo } from "react";
import { DoubleSide, Shape, ShapeGeometry } from "three";
import { Html, Outlines } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { Room as RoomData } from "../types/floorPlan";
import { useEditor } from "../editor/EditorContext";
import { polygonCentroid, rotatePoint } from "../editor/floorPlanEdits";
import { defaultRoomMaterial, resolveMaterial } from "../editor/materials";
import { EditableObject } from "./EditableObject";

interface RoomProps {
  room: RoomData;
  elevation: number;
  wireframe: boolean;
  showLabel: boolean;
}

export function Room({ room, elevation, wireframe, showLabel }: RoomProps) {
  const { selection, select, updateRoom } = useEditor();
  const selected = selection?.kind === "room" && selection.id === room.id;
  const geometry = useMemo(() => createFloorGeometry(room), [room]);
  const material = resolveMaterial(room.material, defaultRoomMaterial(room));
  const centroid = polygonCentroid(room.boundary);
  const y = elevation + room.floorHeight + 0.02;

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <EditableObject
      selected={selected}
      origin={[centroid.x, 0, centroid.y]}
      onCommit={({ dx, dz, yaw }) => {
        const moved = room.boundary.map((point) => ({
          x: point.x + dx,
          y: point.y + dz,
        }));
        const movedLabel = {
          x: room.labelPosition.x + dx,
          y: room.labelPosition.y + dz,
        };
        if (Math.abs(yaw) < 0.001) {
          updateRoom(room.id, { boundary: moved, labelPosition: movedLabel });
          return;
        }
        const pivot = { x: centroid.x + dx, y: centroid.y + dz };
        updateRoom(room.id, {
          boundary: moved.map((point) => rotatePoint(point, pivot, yaw)),
          labelPosition: rotatePoint(movedLabel, pivot, yaw),
        });
      }}
    >
      <mesh
        geometry={geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[-centroid.x, y, -centroid.y]}
        receiveShadow
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          select({ kind: "room", id: room.id });
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <meshStandardMaterial
          color={material.color}
          roughness={material.roughness}
          metalness={material.metalness}
          side={DoubleSide}
          wireframe={wireframe}
          emissive={selected ? "#3f5c4f" : "#000000"}
          emissiveIntensity={selected ? 0.12 : 0}
        />
        {selected ? <Outlines thickness={2.5} color="#2f4a3e" /> : null}
      </mesh>
      {showLabel ? (
        <Html
          position={[
            room.labelPosition.x - centroid.x,
            y + 1.15,
            room.labelPosition.y - centroid.y,
          ]}
          center
          sprite
          distanceFactor={14}
          zIndexRange={[1, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className={selected ? "room-label is-selected" : "room-label"}>
            <span className="room-label-name">{room.name}</span>
            {room.areaSqM !== undefined ? (
              <span className="room-label-area">
                {room.areaSqM.toFixed(1)} m²
              </span>
            ) : null}
          </div>
        </Html>
      ) : null}
    </EditableObject>
  );
}

function createFloorGeometry(room: RoomData): ShapeGeometry {
  const shape = new Shape();
  const [first, ...rest] = room.boundary;
  if (!first) {
    return new ShapeGeometry(shape);
  }
  shape.moveTo(first.x, -first.y);
  for (const point of rest) {
    shape.lineTo(point.x, -point.y);
  }
  shape.closePath();
  return new ShapeGeometry(shape);
}
