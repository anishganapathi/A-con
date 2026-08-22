import { useEffect, useRef, type ComponentProps } from "react";
import { OrbitControls } from "@react-three/drei";
import { MOUSE } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { initialView, persistOrbit, type CameraPose } from "./cameraPose";

type OrbitControlsProps = ComponentProps<typeof OrbitControls>;

/**
 * Figma's habit, which is the one people arrive with: press the scroll wheel
 * and drag to slide the view. OrbitControls dollies on the middle button by
 * default, which the wheel already does.
 */
const FIGMA_BUTTONS = {
  LEFT: MOUSE.ROTATE,
  MIDDLE: MOUSE.PAN,
  RIGHT: MOUSE.PAN,
} as const;

interface PersistedOrbitControlsProps extends Omit<OrbitControlsProps, "target"> {
  fallback: CameraPose;
  persist?: boolean;
}

export function usePersistedView(fallback: CameraPose): CameraPose {
  return useRef(initialView(fallback)).current;
}

export function PersistedOrbitControls({
  fallback,
  persist = true,
  mouseButtons = FIGMA_BUTTONS,
  ...props
}: PersistedOrbitControlsProps) {
  const view = usePersistedView(fallback);
  const controls = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    if (!persist) {
      return;
    }
    if (controls.current) {
      persistOrbit(controls.current);
    }
    return () => {
      if (controls.current) {
        persistOrbit(controls.current);
      }
    };
  }, [persist]);

  return (
    <OrbitControls
      {...props}
      ref={controls}
      mouseButtons={mouseButtons}
      target={view.target}
      onChange={
        persist
          ? (event) => {
              if (event?.target) {
                persistOrbit(event.target);
              }
            }
          : undefined
      }
    />
  );
}
