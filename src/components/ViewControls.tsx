import type { FloorPlan, ViewOptions } from "../types/floorPlan";
import { RailSection } from "./RailSection";

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
  const patch = (partial: Partial<ViewOptions>) => {
    onChange({ ...options, ...partial });
  };
  // Matches the model's fallback so the dropdown never shows a storey that a
  // rebuild removed.
  const activeId =
    floorPlan.floors.find((floor) => floor.id === options.floorId)?.id ??
    floorPlan.floors[0]?.id ??
    "";

  const floor = options.showAllFloors
    ? "All floors"
    : (floorPlan.floors.find((entry) => entry.id === options.floorId)?.name ?? "Floor");

  return (
    <aside className="view-panel" aria-label="View controls">
      {/* Which drawing this is. Never folds away: it is the rail's identity. */}
      <header className="rail-header">
        <p className="view-kicker">{floorPlan.source.sheet}</p>
        <h1>{floorPlan.name}</h1>
        <p className="view-units">{floorPlan.source.title}</p>
      </header>

      <RailSection label="Display" value={floor}>
      <label className="view-field">
        <span>Floor</span>
        <select
          value={options.showAllFloors ? "__all__" : activeId}
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
      </RailSection>
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
