import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { mockFloorPlan } from "../data/mockFloorPlan";
import type {
  ElectricalRun,
  Floor,
  FloorPlan,
  Opening,
  PipeRun,
  Room,
  Selection,
  TransformMode,
  Wall,
} from "../types/floorPlan";
import type { AgentAction } from "../agent/types";
import { applyAgentAction } from "../agent/applyAction";
import { applyPresetToPlan } from "../materials/applyPreset";
import type { MaterialPreset } from "../materials/presets";
import {
  findInPlan,
  patchElectricalInPlan,
  patchOpeningInPlan,
  patchPipeInPlan,
  patchRoomInPlan,
  patchWallInPlan,
  removeSelectionInPlan,
} from "./floorPlanEdits";

const MAX_HISTORY = 50;
const COALESCE_MS = 450;

interface Snapshot {
  floorPlan: FloorPlan;
  selection: Selection | null;
}

interface HistoryState {
  past: Snapshot[];
  present: Snapshot;
  future: Snapshot[];
}

interface EditorContextValue {
  floorPlan: FloorPlan;
  floorId: string;
  floor: Floor | undefined;
  selection: Selection | null;
  transformMode: TransformMode;
  selectedWall: Wall | undefined;
  selectedRoom: Room | undefined;
  selectedOpening: Opening | undefined;
  selectedPipe: PipeRun | undefined;
  selectedElectrical: ElectricalRun | undefined;
  canUndo: boolean;
  canRedo: boolean;
  select: (next: Selection | null) => void;
  setTransformMode: (mode: TransformMode) => void;
  updateWall: (wallId: string, patch: Partial<Wall>) => void;
  updateRoom: (roomId: string, patch: Partial<Room>) => void;
  updateOpening: (openingId: string, patch: Partial<Opening>) => void;
  updatePipe: (pipeId: string, patch: Partial<PipeRun>) => void;
  updateElectrical: (runId: string, patch: Partial<ElectricalRun>) => void;
  removeSelected: () => void;
  undo: () => void;
  redo: () => void;
  resetPlan: () => void;
  replacePlan: (next: FloorPlan) => void;
  applyFinish: (preset: MaterialPreset) => void;
  applyAgentActions: (actions: AgentAction[]) => string[];
}

const EditorContext = createContext<EditorContextValue | null>(null);

interface EditorProviderProps {
  floorId: string;
  children: ReactNode;
}

function initialHistory(): HistoryState {
  return {
    past: [],
    present: {
      floorPlan: structuredClone(mockFloorPlan),
      selection: null,
    },
    future: [],
  };
}

function trimPast(past: Snapshot[]): Snapshot[] {
  return past.length > MAX_HISTORY ? past.slice(-MAX_HISTORY) : past;
}

export function EditorProvider({ floorId, children }: EditorProviderProps) {
  const [history, setHistory] = useState<HistoryState>(initialHistory);
  const [transformMode, setTransformMode] = useState<TransformMode>("translate");
  const lastPushAt = useRef(0);

  const { floorPlan, selection } = history.present;
  const floor =
    floorPlan.floors.find((entry) => entry.id === floorId) ?? floorPlan.floors[0];
  const found = findInPlan(floorPlan, selection);

  const applyEdit = useCallback(
    (updater: (plan: FloorPlan) => FloorPlan, coalesce: boolean) => {
      setHistory((current) => {
        const now = performance.now();
        const skipPush =
          coalesce &&
          current.past.length > 0 &&
          now - lastPushAt.current < COALESCE_MS;
        const present: Snapshot = {
          floorPlan: updater(current.present.floorPlan),
          selection: current.present.selection,
        };
        if (skipPush) {
          return { ...current, present };
        }
        lastPushAt.current = now;
        return {
          present,
          past: trimPast([...current.past, current.present]),
          future: [],
        };
      });
    },
    [],
  );

  const select = useCallback((next: Selection | null) => {
    setHistory((current) => ({
      ...current,
      present: { ...current.present, selection: next },
    }));
  }, []);

  const updateWall = useCallback(
    (wallId: string, patch: Partial<Wall>) => {
      applyEdit((plan) => patchWallInPlan(plan, wallId, patch), true);
    },
    [applyEdit],
  );

  const updateRoom = useCallback(
    (roomId: string, patch: Partial<Room>) => {
      applyEdit((plan) => patchRoomInPlan(plan, roomId, patch), true);
    },
    [applyEdit],
  );

  const updateOpening = useCallback(
    (openingId: string, patch: Partial<Opening>) => {
      applyEdit((plan) => patchOpeningInPlan(plan, openingId, patch), true);
    },
    [applyEdit],
  );

  const updatePipe = useCallback(
    (pipeId: string, patch: Partial<PipeRun>) => {
      applyEdit((plan) => patchPipeInPlan(plan, pipeId, patch), true);
    },
    [applyEdit],
  );

  const updateElectrical = useCallback(
    (runId: string, patch: Partial<ElectricalRun>) => {
      applyEdit((plan) => patchElectricalInPlan(plan, runId, patch), true);
    },
    [applyEdit],
  );

  const removeSelected = useCallback(() => {
    const currentSelection = history.present.selection;
    if (!currentSelection) {
      return;
    }
    lastPushAt.current = 0;
    setHistory((current) => {
      const selected = current.present.selection;
      if (!selected) {
        return current;
      }
      return {
        present: {
          floorPlan: removeSelectionInPlan(current.present.floorPlan, selected),
          selection: null,
        },
        past: trimPast([...current.past, current.present]),
        future: [],
      };
    });
  }, [history.present.selection]);

  const undo = useCallback(() => {
    lastPushAt.current = 0;
    setHistory((current) => {
      const previous = current.past[current.past.length - 1];
      if (!previous) {
        return current;
      }
      return {
        present: previous,
        past: current.past.slice(0, -1),
        future: [current.present, ...current.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    lastPushAt.current = 0;
    setHistory((current) => {
      const [next, ...rest] = current.future;
      if (!next) {
        return current;
      }
      return {
        present: next,
        past: trimPast([...current.past, current.present]),
        future: rest,
      };
    });
  }, []);

  const resetPlan = useCallback(() => {
    lastPushAt.current = 0;
    setHistory((current) => ({
      present: {
        floorPlan: structuredClone(mockFloorPlan),
        selection: null,
      },
      past: trimPast([...current.past, current.present]),
      future: [],
    }));
  }, []);

  const replacePlan = useCallback((next: FloorPlan) => {
    lastPushAt.current = 0;
    setHistory((current) => ({
      present: { floorPlan: next, selection: null },
      past: trimPast([...current.past, current.present]),
      future: [],
    }));
  }, []);

  /** A finish is a building-wide decision, so it is one undoable step. */
  const applyFinish = useCallback(
    (preset: MaterialPreset) => {
      lastPushAt.current = 0;
      applyEdit((plan) => applyPresetToPlan(plan, preset), false);
    },
    [applyEdit],
  );

  const applyAgentActions = useCallback((actions: AgentAction[]) => {
    if (actions.length === 0) {
      return [];
    }
    lastPushAt.current = 0;
    const labels: string[] = [];
    setHistory((current) => {
      let floorPlan = current.present.floorPlan;
      for (const action of actions) {
        floorPlan = applyAgentAction(floorPlan, action);
        labels.push(
          action.type === "replace_plan" ? action.note : action.type,
        );
      }
      return {
        present: { floorPlan, selection: null },
        past: trimPast([...current.past, current.present]),
        future: [],
      };
    });
    return labels;
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isTextEditing =
        (target instanceof HTMLInputElement &&
          (target.type === "text" || target.type === "search")) ||
        target instanceof HTMLTextAreaElement;
      const isFormField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;
      const hasModifier = event.metaKey || event.ctrlKey;

      if (hasModifier && event.key.toLowerCase() === "z") {
        if (!isTextEditing) {
          event.preventDefault();
          if (event.shiftKey) {
            redo();
          } else {
            undo();
          }
        }
        return;
      }
      if (hasModifier && event.key.toLowerCase() === "y") {
        if (!isTextEditing) {
          event.preventDefault();
          redo();
        }
        return;
      }
      if (isFormField) {
        return;
      }
      if (event.key === "Escape") {
        select(null);
      }
      if (
        (event.key === "Backspace" || event.key === "Delete") &&
        selection
      ) {
        event.preventDefault();
        removeSelected();
      }
      if (event.key === "g" || event.key === "G") {
        setTransformMode("translate");
      }
      if (event.key === "r" || event.key === "R") {
        setTransformMode("rotate");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redo, removeSelected, select, selection, undo]);

  const value = useMemo<EditorContextValue>(
    () => ({
      floorPlan,
      floorId,
      floor,
      selection,
      transformMode,
      selectedWall: found.wall,
      selectedRoom: found.room,
      selectedOpening: found.opening,
      selectedPipe: found.pipe,
      selectedElectrical: found.electrical,
      canUndo: history.past.length > 0,
      canRedo: history.future.length > 0,
      select,
      setTransformMode,
      updateWall,
      updateRoom,
      updateOpening,
      updatePipe,
      updateElectrical,
      removeSelected,
      undo,
      redo,
      resetPlan,
      replacePlan,
      applyFinish,
      applyAgentActions,
    }),
    [
      applyFinish,
      floor,
      floorId,
      floorPlan,
      found.electrical,
      found.opening,
      found.pipe,
      found.room,
      found.wall,
      history.future.length,
      history.past.length,
      redo,
      removeSelected,
      applyAgentActions,
      replacePlan,
      resetPlan,
      select,
      selection,
      transformMode,
      undo,
      updateElectrical,
      updateOpening,
      updatePipe,
      updateRoom,
      updateWall,
    ],
  );

  return (
    <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
  );
}

export function useEditor(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) {
    throw new Error("useEditor must be used within EditorProvider");
  }
  return value;
}
