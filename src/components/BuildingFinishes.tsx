import { useState } from "react";
import { useEditor } from "../editor/EditorContext";
import { currentFinish } from "../materials/applyPreset";
import type { PresetSurface } from "../materials/presets";
import { MaterialPresets } from "./MaterialPresets";

const TABS: { surface: PresetSurface; label: string }[] = [
  { surface: "facade", label: "Outer" },
  { surface: "glazing", label: "Glass" },
  { surface: "roof", label: "Roof" },
  { surface: "interior", label: "Inner" },
  { surface: "floor", label: "Floor" },
];

/**
 * Finishes for the whole building. One click dresses every surface of that kind
 * on every storey, which is how the choice is actually made — you pick brick for
 * a building, not for one wall.
 */
export function BuildingFinishes() {
  const { floorPlan, applyFinish } = useEditor();
  const [surface, setSurface] = useState<PresetSurface>("facade");
  const active = currentFinish(floorPlan, surface);

  return (
    // Foldable: the rail also holds the view controls and the inspector, and on a
    // short window something has to give way.
    <details className="finishes-panel" open>
      <summary className="finishes-summary">
        <span className="view-kicker">Finishes</span>
        <span className="finishes-current">{active ? active.name : "Custom"}</span>
      </summary>
      <div className="finish-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.surface}
            type="button"
            role="tab"
            aria-selected={surface === tab.surface}
            className={surface === tab.surface ? "finish-tab is-active" : "finish-tab"}
            onClick={() => setSurface(tab.surface)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <MaterialPresets
        surface={surface}
        label={`${surface} finishes`}
        showLabel={false}
        activeId={active?.id}
        onPick={applyFinish}
      />
    </details>
  );
}
