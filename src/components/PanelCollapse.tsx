import { motion } from "motion/react";
import { POP } from "./motionTokens";

type Side = "left" | "right";

/**
 * Folds a whole panel away. Sits in the panel's own corner and points outward,
 * toward where the panel is about to go.
 */
export function CollapseButton({
  side,
  label,
  onClick,
}: {
  side: Side;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="panel-collapse"
      aria-label={label}
      aria-expanded
      title={label}
      onClick={onClick}
    >
      <ChevronIcon direction={side} />
    </button>
  );
}

/**
 * What is left behind when a panel is folded: a handle on the same edge, so the
 * model gets the room and the panel is one click away.
 */
export function PanelLauncher({
  side,
  label,
  busy = false,
  onClick,
}: {
  side: Side;
  label: string;
  /** Something is still running in there, worth a nudge while it is hidden. */
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      className={`panel-launcher is-${side}`}
      aria-label={label}
      aria-expanded={false}
      title={label}
      onClick={onClick}
      // Arrives a beat late, so it is not sitting in the corner the panel is
      // still leaving, but leaves at once when the panel is on its way back.
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1, transition: { ...POP, delay: 0.16 } }}
      exit={{ opacity: 0, scale: 0.7, transition: POP }}
      whileTap={{ scale: 0.94 }}
    >
      <PanelIcon side={side} />
      {busy ? <span className="panel-launcher-dot" /> : null}
    </motion.button>
  );
}

function ChevronIcon({ direction }: { direction: Side }) {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
      <path
        d={direction === "left" ? "M7.5 2.5 4 6l3.5 3.5" : "M4.5 2.5 8 6l-3.5 3.5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A pane with its rail on the side the panel lives on. */
function PanelIcon({ side }: { side: Side }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
      <rect
        x="1.75"
        y="2.75"
        width="12.5"
        height="10.5"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d={side === "left" ? "M6.25 2.75v10.5" : "M9.75 2.75v10.5"}
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}
