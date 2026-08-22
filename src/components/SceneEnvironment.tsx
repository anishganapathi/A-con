import { Suspense, useEffect, useState } from "react";
import { Environment } from "@react-three/drei";

/**
 * An image-based light so metal and glass have something to reflect. Without it
 * a polished aluminium panel and a matte render differ only in shading, which
 * makes half the finish library look the same.
 *
 * The map is a bundled HDRI rather than a CDN preset: the desktop build serves
 * itself and has no outside network, so anything fetched over the wire would
 * simply fail there.
 */
export function SceneEnvironment({ intensity }: { intensity: number }) {
  const file = useHdri();

  if (!file) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <Environment files={file} background={false} environmentIntensity={intensity} />
    </Suspense>
  );
}

/** Pulled in on demand: it is ~180 KB of base64 that the first paint does not need. */
function useHdri(): string | null {
  const [file, setFile] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void import("@pmndrs/assets/hdri/city.exr.js").then((module) => {
      if (live) {
        setFile(module.default);
      }
    });
    return () => {
      live = false;
    };
  }, []);

  return file;
}
