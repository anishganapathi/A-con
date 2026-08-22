import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ConstructionPhase =
  | "idle"
  | "site"
  | "slab"
  | "structure"
  | "enclosure"
  | "roof"
  | "mep"
  | "complete";

export interface ConstructionReveal {
  playing: boolean;
  progress: number;
  phase: ConstructionPhase;
  label: string;
  showSlabs: boolean;
  showWalls: boolean;
  wallScale: number;
  showRooms: boolean;
  showOpenings: boolean;
  showRoof: boolean;
  showMep: boolean;
}

const IDLE: ConstructionReveal = {
  playing: false,
  progress: 1,
  phase: "complete",
  label: "Complete",
  showSlabs: true,
  showWalls: true,
  wallScale: 1,
  showRooms: true,
  showOpenings: true,
  showRoof: true,
  showMep: true,
};

interface ConstructionContextValue extends ConstructionReveal {
  startPlayback: (durationMs?: number) => void;
}

const ConstructionContext = createContext<ConstructionContextValue | null>(null);

export function ConstructionProvider({ children }: { children: ReactNode }) {
  const [reveal, setReveal] = useState<ConstructionReveal>(IDLE);
  const frame = useRef<number>(0);

  const startPlayback = useCallback((durationMs = 11000) => {
    cancelAnimationFrame(frame.current);
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / durationMs);
      setReveal({ ...revealFromProgress(progress), playing: progress < 1 });
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    };
    setReveal({ ...revealFromProgress(0), playing: true });
    frame.current = requestAnimationFrame(tick);
  }, []);

  const value = useMemo<ConstructionContextValue>(
    () => ({ ...reveal, startPlayback }),
    [reveal, startPlayback],
  );

  return (
    <ConstructionContext.Provider value={value}>
      {children}
    </ConstructionContext.Provider>
  );
}

export function useConstruction(): ConstructionContextValue {
  const value = useContext(ConstructionContext);
  if (!value) {
    throw new Error("useConstruction must be used within ConstructionProvider");
  }
  return value;
}

export function revealFromProgress(progress: number): Omit<ConstructionReveal, "playing"> {
  if (progress < 0.1) {
    return {
      progress,
      phase: "site",
      label: "Clearing the site",
      showSlabs: false,
      showWalls: false,
      wallScale: 0,
      showRooms: false,
      showOpenings: false,
      showRoof: false,
      showMep: false,
    };
  }
  if (progress < 0.22) {
    return {
      progress,
      phase: "slab",
      label: "Pouring floor slabs",
      showSlabs: true,
      showWalls: false,
      wallScale: 0,
      showRooms: false,
      showOpenings: false,
      showRoof: false,
      showMep: false,
    };
  }
  if (progress < 0.62) {
    const wallScale = (progress - 0.22) / 0.4;
    return {
      progress,
      phase: "structure",
      label: `Raising structure ${Math.round(wallScale * 100)}%`,
      showSlabs: true,
      showWalls: true,
      wallScale,
      showRooms: wallScale > 0.35,
      showOpenings: false,
      showRoof: false,
      showMep: false,
    };
  }
  if (progress < 0.74) {
    return {
      progress,
      phase: "enclosure",
      label: "Cutting doors and storefronts",
      showSlabs: true,
      showWalls: true,
      wallScale: 1,
      showRooms: true,
      showOpenings: true,
      showRoof: false,
      showMep: false,
    };
  }
  if (progress < 0.86) {
    return {
      progress,
      phase: "roof",
      label: "Setting the roof",
      showSlabs: true,
      showWalls: true,
      wallScale: 1,
      showRooms: true,
      showOpenings: true,
      showRoof: true,
      showMep: false,
    };
  }
  if (progress < 0.98) {
    return {
      progress,
      phase: "mep",
      label: "Pulling pipes and electrical",
      showSlabs: true,
      showWalls: true,
      wallScale: 1,
      showRooms: true,
      showOpenings: true,
      showRoof: true,
      showMep: true,
    };
  }
  return {
    progress: 1,
    phase: "complete",
    label: "Construction complete",
    showSlabs: true,
    showWalls: true,
    wallScale: 1,
    showRooms: true,
    showOpenings: true,
    showRoof: true,
    showMep: true,
  };
}
