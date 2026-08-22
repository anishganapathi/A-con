import { useEffect, useRef, type ComponentProps } from "react";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { initialView, persistOrbit, type CameraPose } from "./cameraPose";

type OrbitControlsProps = ComponentProps<typeof OrbitControls>;

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
