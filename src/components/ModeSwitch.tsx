import { motion } from "motion/react";
import type { AppMode } from "../types/floorPlan";
import { PILL } from "./motionTokens";

interface ModeSwitchProps {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

const MODES: { id: AppMode; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "experience", label: "Experience" },
];

export function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  return (
    <div className="mode-switch" role="tablist" aria-label="Viewer mode">
      {MODES.map((entry) => {
        const active = mode === entry.id;
        return (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? "mode-tab is-active" : "mode-tab"}
            onClick={() => onChange(entry.id)}
          >
            {/* A single pill shared by both tabs, so it travels across the switch
                instead of blinking out of one and into the other. */}
            {active ? (
              <motion.span
                layoutId="mode-pill"
                className="mode-pill"
                transition={PILL}
              />
            ) : null}
            <span className="mode-tab-label">{entry.label}</span>
          </button>
        );
      })}
    </div>
  );
}
