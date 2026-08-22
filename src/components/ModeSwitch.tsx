import type { AppMode } from "../types/floorPlan";

interface ModeSwitchProps {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

export function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  return (
    <div className="mode-switch" role="tablist" aria-label="Viewer mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "plan"}
        className={mode === "plan" ? "mode-tab is-active" : "mode-tab"}
        onClick={() => onChange("plan")}
      >
        Plan
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "experience"}
        className={mode === "experience" ? "mode-tab is-active" : "mode-tab"}
        onClick={() => onChange("experience")}
      >
        Experience
      </button>
    </div>
  );
}
