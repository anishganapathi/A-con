import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useEditor } from "../editor/EditorContext";
import type { ViewOptions } from "../types/floorPlan";
import { BuildingFinishes } from "./BuildingFinishes";
import { Inspector } from "./Inspector";
import { SWEEP } from "./motionTokens";
import { CollapseButton, PanelLauncher } from "./PanelCollapse";
import { RailActions } from "./RailActions";
import { ViewControls } from "./ViewControls";

/**
 * The plan controls, finishes and inspector as one pane of glass. Folds away to
 * a handle so the model can have the whole window.
 */
export function LeftRail({
  options,
  onChange,
}: {
  options: ViewOptions;
  onChange: (next: ViewOptions) => void;
}) {
  const { floorPlan, selection } = useEditor();
  const [open, setOpen] = useState(true);
  const picked = selection ? `${selection.kind}:${selection.id}` : null;

  // Clicking something in the model is a request to edit it, so the rail comes
  // back rather than leaving the click with nowhere to land. Deselecting does
  // not reopen it.
  useEffect(() => {
    if (picked) {
      setOpen(true);
    }
  }, [picked]);

  // The rail and its handle cross over rather than queue: mode="wait" would make
  // reopening depend on the outgoing animation reporting back, and a click landing
  // in that window leaves the rail stuck shut. The handle's delayed entrance keeps
  // the crossover from looking doubled.
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          key="rail"
          className="left-rail"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={SWEEP}
        >
          <CollapseButton side="left" label="Hide plan controls" onClick={() => setOpen(false)} />
          {/* One scroller for the whole rail: the sections keep their natural
              height instead of competing for a fixed budget. */}
          <div className="rail-scroll">
            <ViewControls floorPlan={floorPlan} options={options} onChange={onChange} />
            <BuildingFinishes />
            <Inspector />
          </div>
          <RailActions />
        </motion.div>
      ) : (
        <PanelLauncher
          key="handle"
          side="left"
          label="Show plan controls"
          onClick={() => setOpen(true)}
        />
      )}
    </AnimatePresence>
  );
}
