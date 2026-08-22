import type { FloorPlan, ViewOptions } from "../types/floorPlan";
import { useEditor } from "../editor/EditorContext";

interface ViewControlsProps {
  floorPlan: FloorPlan;
  options: ViewOptions;
  onChange: (next: ViewOptions) => void;
}

export function ViewControls({
  floorPlan,
  options,
  onChange,
}: ViewControlsProps) {
  const { resetPlan, undo, redo, canUndo, canRedo } = useEditor();
  const patch = (partial: Partial<ViewOptions>) => {
    onChange({ ...options, ...partial });
  };

  return (
    <aside className="view-panel" aria-label="View controls">
      <header className="view-panel-header">
        <p className="view-kicker">{floorPlan.source.sheet}</p>
        <h1>{floorPlan.name}</h1>
        <p className="view-units">{floorPlan.source.title}</p>
      </header>

      <label className="view-field">
        <span>Floor</span>
        <select
          value={options.showAllFloors ? "__all__" : options.floorId}
          onChange={(event) => {
            const value = event.target.value;
            if (value === "__all__") {
              patch({ showAllFloors: true });
              return;
            }
            patch({ showAllFloors: false, floorId: value });
          }}
        >
          <option value="__all__">All floors</option>
          {floorPlan.floors.map((floor) => (
            <option key={floor.id} value={floor.id}>
              {floor.name}
            </option>
          ))}
        </select>
      </label>

      <div className="view-toggles">
        <Toggle
          label="Plan dimensions"
          pressed={options.showDimensions}
          onClick={() => patch({ showDimensions: !options.showDimensions })}
        />
        <Toggle
          label="Elevation datums"
          pressed={options.showDatums}
          onClick={() => patch({ showDatums: !options.showDatums })}
        />
        <Toggle
          label="Roof"
          pressed={options.showRoof}
          onClick={() => patch({ showRoof: !options.showRoof })}
        />
        <Toggle
          label="Pipes"
          pressed={options.showPipes}
          onClick={() => patch({ showPipes: !options.showPipes })}
        />
        <Toggle
          label="Electrical"
          pressed={options.showElectrical}
          onClick={() =>
            patch({ showElectrical: !options.showElectrical })
          }
        />
        <Toggle
          label="Room labels"
          pressed={options.showRoomLabels}
          onClick={() => patch({ showRoomLabels: !options.showRoomLabels })}
        />
        <Toggle
          label="Wireframe"
          pressed={options.wireframe}
          onClick={() => patch({ wireframe: !options.wireframe })}
        />
      </div>

      <p className="view-hint">
        Click a wall, floor, door, window, pipe, or wire to edit · Drag the gizmo to
        move · G move · R rotate · Delete to remove · ⌘Z / Ctrl+Z undo
      </p>
      <div className="history-actions">
        <button
          type="button"
          className="btn-ghost"
          onClick={undo}
          disabled={!canUndo}
        >
          Undo
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={redo}
          disabled={!canRedo}
        >
          Redo
        </button>
      </div>
      <button type="button" className="btn-ghost reset-plan" onClick={resetPlan}>
        Reset plan
      </button>
    </aside>
  );
}

interface ToggleProps {
  label: string;
  pressed: boolean;
  onClick: () => void;
}

function Toggle({ label, pressed, onClick }: ToggleProps) {
  return (
    <button
      type="button"
      className={pressed ? "toggle is-on" : "toggle"}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <span className="toggle-dot" />
      {label}
    </button>
  );
}
