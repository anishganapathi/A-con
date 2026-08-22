import { TransformControls } from "@react-three/drei";
import { useLayoutEffect, useRef, useState } from "react";
import type { Group } from "three";
import { useEditor } from "../editor/EditorContext";
import { snapMeters } from "../editor/floorPlanEdits";

interface EditableObjectProps {
  selected: boolean;
  origin: [number, number, number];
  children: React.ReactNode;
  onCommit: (delta: { dx: number; dz: number; yaw: number }) => void;
}

export function EditableObject({
  selected,
  origin,
  children,
  onCommit,
}: EditableObjectProps) {
  const groupRef = useRef<Group>(null);
  const [target, setTarget] = useState<Group | null>(null);
  const { transformMode } = useEditor();
  const isRotate = transformMode === "rotate";

  useLayoutEffect(() => {
    setTarget(selected ? groupRef.current : null);
  }, [selected]);

  const commit = () => {
    const group = groupRef.current;
    if (!group) {
      return;
    }
    const dx = snapMeters(group.position.x - origin[0]);
    const dz = snapMeters(group.position.z - origin[2]);
    const yaw = group.rotation.y;
    if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001 && Math.abs(yaw) < 0.001) {
      group.position.set(origin[0], origin[1], origin[2]);
      group.rotation.set(0, 0, 0);
      return;
    }
    onCommit({ dx, dz, yaw });
  };

  return (
    <>
      <group ref={groupRef} position={origin} rotation={[0, 0, 0]}>
        {children}
      </group>
      {selected && target ? (
        <TransformControls
          object={target}
          mode={transformMode}
          space="world"
          showX={!isRotate}
          showY={isRotate}
          showZ={!isRotate}
          size={0.85}
          translationSnap={0.05}
          rotationSnap={Math.PI / 36}
          onMouseUp={commit}
        />
      ) : null}
    </>
  );
}
