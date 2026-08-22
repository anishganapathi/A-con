import { useEffect, useRef } from "react";
import type {
  ElectricalRun,
  Opening,
  PipeRun,
  Room,
  SelectableKind,
  Selection,
  SurfaceMaterial,
  Wall,
} from "../types/floorPlan";
import { useEditor } from "../editor/EditorContext";
import {
  defaultElectricalMaterial,
  defaultOpeningMaterial,
  defaultPipeMaterial,
  defaultRoomMaterial,
  defaultWallMaterial,
  resolveMaterial,
} from "../editor/materials";
import {
  matchPreset,
  surfaceForSelection,
  type PresetSurface,
} from "../materials/presets";
import { MaterialPresets } from "./MaterialPresets";

export function Inspector() {
  const {
    selection,
    selectedWall,
    selectedRoom,
    selectedOpening,
    selectedPipe,
    selectedElectrical,
    transformMode,
    setTransformMode,
    updateWall,
    updateRoom,
    updateOpening,
    updatePipe,
    updateElectrical,
    removeSelected,
    select,
  } = useEditor();
  const panel = useSelectionInView(selection);

  if (!selection) {
    return (
      <aside ref={panel} className="inspector-panel" aria-label="Object inspector">
        <p className="view-kicker">Inspector</p>
        <h1>Nothing selected</h1>
        <p className="inspector-empty">
          Click a wall, floor, door, window, pipe, or wire run to move it,
          change its material, or delete it.
        </p>
      </aside>
    );
  }

  return (
    <aside ref={panel} className="inspector-panel" aria-label="Object inspector">
      <header className="view-panel-header">
        <p className="view-kicker">Inspector</p>
        <h1>
          {titleForSelection(
            selection.kind,
            selectedRoom?.name ?? selectedPipe?.name ?? selectedElectrical?.name,
          )}
        </h1>
        <p className="view-units">{selection.id}</p>
      </header>

      {selectedWall || selectedRoom || selectedPipe || selectedElectrical ? (
        <div className="inspector-modes">
          <button
            type="button"
            className={transformMode === "translate" ? "toggle is-on" : "toggle"}
            aria-pressed={transformMode === "translate"}
            onClick={() => setTransformMode("translate")}
          >
            Move
          </button>
          <button
            type="button"
            className={transformMode === "rotate" ? "toggle is-on" : "toggle"}
            aria-pressed={transformMode === "rotate"}
            onClick={() => setTransformMode("rotate")}
          >
            Rotate
          </button>
        </div>
      ) : null}

      {selectedWall ? (
        <WallFields
          wall={selectedWall}
          onChange={(patch) => updateWall(selectedWall.id, patch)}
        />
      ) : null}

      {selectedRoom ? (
        <RoomFields
          room={selectedRoom}
          onChange={(patch) => updateRoom(selectedRoom.id, patch)}
        />
      ) : null}

      {selectedOpening ? (
        <OpeningFields
          opening={selectedOpening}
          onChange={(patch) => updateOpening(selectedOpening.id, patch)}
        />
      ) : null}

      {selectedPipe ? (
        <PipeFields
          pipe={selectedPipe}
          onChange={(patch) => updatePipe(selectedPipe.id, patch)}
        />
      ) : null}

      {selectedElectrical ? (
        <ElectricalFields
          run={selectedElectrical}
          onChange={(patch) => updateElectrical(selectedElectrical.id, patch)}
        />
      ) : null}

      <div className="inspector-actions">
        <button type="button" className="btn-danger" onClick={removeSelected}>
          Delete
        </button>
        <button type="button" className="btn-ghost" onClick={() => select(null)}>
          Deselect
        </button>
      </div>
    </aside>
  );
}

function titleForSelection(kind: SelectableKind, name: string | undefined) {
  if (kind === "wall") {
    return "Wall";
  }
  if (kind === "room") {
    return name ?? "Room";
  }
  if (kind === "pipe") {
    return name ?? "Pipe";
  }
  if (kind === "electrical") {
    return name ?? "Electrical";
  }
  return "Opening";
}

function WallFields({
  wall,
  onChange,
}: {
  wall: Wall;
  onChange: (patch: Partial<Wall>) => void;
}) {
  const material = resolveMaterial(wall.material, defaultWallMaterial(wall));
  return (
    <div className="inspector-fields">
      <label className="view-field">
        <span>Type</span>
        <select
          value={wall.type}
          onChange={(event) =>
            onChange({ type: event.target.value as Wall["type"] })
          }
        >
          <option value="exterior">Exterior</option>
          <option value="interior">Interior</option>
          <option value="partition">Partition</option>
        </select>
      </label>
      <MaterialFields
        material={material}
        surface={surfaceForSelection("wall", wall.type)}
        onChange={(next) => onChange({ material: next })}
      />
      <NumberField
        label="Height (m)"
        value={wall.height}
        min={0.5}
        max={6}
        step={0.05}
        onChange={(height) => onChange({ height })}
      />
      <NumberField
        label="Thickness (m)"
        value={wall.thickness}
        min={0.05}
        max={0.8}
        step={0.01}
        onChange={(thickness) => onChange({ thickness })}
      />
    </div>
  );
}

function RoomFields({
  room,
  onChange,
}: {
  room: Room;
  onChange: (patch: Partial<Room>) => void;
}) {
  const material = resolveMaterial(room.material, defaultRoomMaterial(room));
  return (
    <div className="inspector-fields">
      <label className="view-field">
        <span>Name</span>
        <input
          type="text"
          value={room.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </label>
      <MaterialFields
        material={material}
        surface={surfaceForSelection("room")}
        onChange={(next) => onChange({ material: next })}
      />
    </div>
  );
}

function PipeFields({
  pipe,
  onChange,
}: {
  pipe: PipeRun;
  onChange: (patch: Partial<PipeRun>) => void;
}) {
  const material = resolveMaterial(pipe.material, defaultPipeMaterial(pipe));
  return (
    <div className="inspector-fields">
      <label className="view-field">
        <span>Name</span>
        <input
          type="text"
          value={pipe.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </label>
      <label className="view-field">
        <span>System</span>
        <select
          value={pipe.system}
          onChange={(event) =>
            onChange({ system: event.target.value as PipeRun["system"] })
          }
        >
          <option value="supply">Supply</option>
          <option value="waste">Waste</option>
          <option value="vent">Vent</option>
          <option value="gas">Gas</option>
        </select>
      </label>
      <MaterialFields
        material={material}
        onChange={(next) => onChange({ material: next })}
      />
      <NumberField
        label="Diameter (m)"
        value={pipe.diameter}
        min={0.01}
        max={0.3}
        step={0.002}
        onChange={(diameter) => onChange({ diameter })}
      />
    </div>
  );
}

function ElectricalFields({
  run,
  onChange,
}: {
  run: ElectricalRun;
  onChange: (patch: Partial<ElectricalRun>) => void;
}) {
  const material = resolveMaterial(
    run.material,
    defaultElectricalMaterial(run),
  );
  return (
    <div className="inspector-fields">
      <label className="view-field">
        <span>Name</span>
        <input
          type="text"
          value={run.name}
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </label>
      <label className="view-field">
        <span>Circuit</span>
        <select
          value={run.circuit}
          onChange={(event) =>
            onChange({
              circuit: event.target.value as ElectricalRun["circuit"],
            })
          }
        >
          <option value="power">Power</option>
          <option value="lighting">Lighting</option>
          <option value="data">Data</option>
        </select>
      </label>
      <MaterialFields
        material={material}
        onChange={(next) => onChange({ material: next })}
      />
      <NumberField
        label="Diameter (m)"
        value={run.diameter}
        min={0.008}
        max={0.12}
        step={0.002}
        onChange={(diameter) => onChange({ diameter })}
      />
    </div>
  );
}

function OpeningFields({
  opening,
  onChange,
}: {
  opening: Opening;
  onChange: (patch: Partial<Opening>) => void;
}) {
  const material = resolveMaterial(
    opening.material,
    defaultOpeningMaterial(opening),
  );
  return (
    <div className="inspector-fields">
      <label className="view-field">
        <span>Type</span>
        <select
          value={opening.type}
          onChange={(event) =>
            onChange({ type: event.target.value as Opening["type"] })
          }
        >
          <option value="door">Door</option>
          <option value="window">Window</option>
        </select>
      </label>
      <MaterialFields
        material={material}
        surface={surfaceForSelection("opening")}
        showOpacity
        onChange={(next) => onChange({ material: next })}
      />
      <NumberField
        label="Width (m)"
        value={opening.width}
        min={0.3}
        max={4}
        step={0.05}
        onChange={(width) => onChange({ width })}
      />
      <NumberField
        label="Height (m)"
        value={opening.height}
        min={0.3}
        max={3}
        step={0.05}
        onChange={(height) => onChange({ height })}
      />
      <NumberField
        label="Sill height (m)"
        value={opening.sillHeight}
        min={0}
        max={2}
        step={0.05}
        onChange={(sillHeight) => onChange({ sillHeight })}
      />
    </div>
  );
}

/**
 * Clicking a wall in the model is a long way from the rail, and the inspector may
 * be below the fold, so a fresh selection brings itself into view. Keyed on what
 * is selected rather than on every edit, so dragging a slider does not scroll.
 */
function useSelectionInView(selection: Selection | null) {
  const panel = useRef<HTMLElement>(null);
  const key = selection ? `${selection.kind}:${selection.id}` : null;

  useEffect(() => {
    if (!key) {
      return;
    }
    panel.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [key]);

  return panel;
}

function MaterialFields({
  material,
  surface = null,
  showOpacity = false,
  onChange,
}: {
  material: SurfaceMaterial;
  surface?: PresetSurface | null;
  showOpacity?: boolean;
  onChange: (next: SurfaceMaterial) => void;
}) {
  return (
    <>
      {surface ? (
        <MaterialPresets
          surface={surface}
          label="Finish"
          activeId={matchPreset(material, surface)?.id}
          onPick={(preset) => onChange({ ...preset.material })}
        />
      ) : null}
      <label className="view-field color-field">
        <span>Color</span>
        <input
          type="color"
          value={toHex(material.color)}
          onChange={(event) =>
            onChange({ ...material, color: event.target.value })
          }
        />
      </label>
      <RangeField
        label="Roughness"
        value={material.roughness}
        onChange={(roughness) => onChange({ ...material, roughness })}
      />
      <RangeField
        label="Metalness"
        value={material.metalness}
        onChange={(metalness) => onChange({ ...material, metalness })}
      />
      {showOpacity ? (
        <RangeField
          label="Opacity"
          value={material.opacity ?? 1}
          onChange={(opacity) => onChange({ ...material, opacity })}
        />
      ) : null}
    </>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="view-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number(value.toFixed(3))}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) {
            onChange(Math.min(max, Math.max(min, next)));
          }
        }}
      />
    </label>
  );
}

function RangeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="view-field">
      <span>
        {label}
        <em>{value.toFixed(2)}</em>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function toHex(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }
  return "#cccccc";
}
