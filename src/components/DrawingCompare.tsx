import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { POP, SWEEP } from "./motionTokens";
import { useReferenceDrawings } from "./referenceDrawings";

type CompareMode = "side" | "overlay";

/**
 * Holds an uploaded drawing up against what was built from it. Side by side
 * reads the sheet; overlay ghosts it across the viewport so the model can be
 * orbited into alignment underneath.
 */
export function DrawingCompare() {
  const drawings = useReferenceDrawings();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CompareMode>("side");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [opacity, setOpacity] = useState(0.45);

  if (drawings.length === 0) {
    return null;
  }
  // A pick can age out of the list, and the newest sheet is the one just built
  // from, so that is what a stale id falls back to.
  const active = drawings.find((entry) => entry.id === pickedId) ?? drawings[0];

  return (
    <>
      {open && mode === "overlay" ? (
        <div className="compare-ghost" aria-hidden>
          <img src={active.dataUrl} alt="" style={{ opacity }} />
        </div>
      ) : null}

      <AnimatePresence initial={false}>
        {open ? (
          <motion.aside
            key="compare"
            className="compare-panel"
            aria-label="Compare drawing"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={SWEEP}
          >
            <header className="compare-head">
              <div>
                <p className="view-kicker">Compare</p>
                <h1>{active.name}</h1>
              </div>
              <button
                type="button"
                className="compare-close"
                aria-label="Close compare"
                title="Close compare"
                onClick={() => setOpen(false)}
              >
                <CloseIcon />
              </button>
            </header>

            <div className="compare-modes" role="group" aria-label="Compare mode">
              <button
                type="button"
                className={mode === "side" ? "compare-mode is-on" : "compare-mode"}
                aria-pressed={mode === "side"}
                onClick={() => setMode("side")}
              >
                Side by side
              </button>
              <button
                type="button"
                className={mode === "overlay" ? "compare-mode is-on" : "compare-mode"}
                aria-pressed={mode === "overlay"}
                onClick={() => setMode("overlay")}
              >
                Overlay
              </button>
            </div>

            {mode === "side" ? (
              <figure className="compare-sheet">
                <img src={active.dataUrl} alt={active.name} />
              </figure>
            ) : (
              <label className="compare-fade">
                <span>Drawing {Math.round(opacity * 100)}%</span>
                <input
                  type="range"
                  min={0.1}
                  max={0.9}
                  step={0.05}
                  value={opacity}
                  onChange={(event) => setOpacity(Number(event.target.value))}
                />
                <span className="compare-hint">
                  Orbit the model underneath to line it up.
                </span>
              </label>
            )}

            {drawings.length > 1 ? (
              <div className="compare-strip" role="group" aria-label="Recent drawings">
                {drawings.map((drawing) => (
                  <button
                    key={drawing.id}
                    type="button"
                    className={
                      drawing.id === active.id ? "compare-thumb is-on" : "compare-thumb"
                    }
                    aria-pressed={drawing.id === active.id}
                    title={drawing.name}
                    onClick={() => setPickedId(drawing.id)}
                  >
                    <img src={drawing.dataUrl} alt={drawing.name} />
                  </button>
                ))}
              </div>
            ) : null}
          </motion.aside>
        ) : (
          <motion.button
            key="compare-launch"
            type="button"
            className="compare-launcher"
            title="Compare against the drawing"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1, transition: { ...POP, delay: 0.12 } }}
            exit={{ opacity: 0, scale: 0.8, transition: POP }}
            whileTap={{ scale: 0.94 }}
          >
            <CompareIcon />
            Compare
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}

/** Two sheets, offset, the way the drawing sits over the model. */
function CompareIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
      <rect
        x="1.75"
        y="1.75"
        width="9"
        height="9"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect
        x="5.25"
        y="5.25"
        width="9"
        height="9"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
      <path
        d="M3 3l6 6M9 3l-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
