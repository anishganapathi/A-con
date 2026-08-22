import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useState } from "react";
import { ChatPanel } from "./components/ChatPanel";
import { ConstructionHud } from "./components/ConstructionHud";
import { DrawingCompare } from "./components/DrawingCompare";
import { ExperienceScene } from "./components/ExperienceScene";
import { LeftRail } from "./components/LeftRail";
import { ModeSwitch } from "./components/ModeSwitch";
import { DISSOLVE } from "./components/motionTokens";
import { Scene } from "./components/Scene";
import { TitleBar } from "./components/TitleBar";
import { useLiquidGlass } from "./components/useLiquidGlass";
import { ConstructionProvider } from "./editor/ConstructionContext";
import { EditorProvider, useEditor } from "./editor/EditorContext";
import type { AppMode, ViewOptions } from "./types/floorPlan";
import { mockFloorPlan } from "./data/mockFloorPlan";

const initialFloorId = mockFloorPlan.floors[0]?.id ?? "";

const initialOptions: ViewOptions = {
  floorId: initialFloorId,
  appMode: "plan",
  showAllFloors: true,
  showDimensions: true,
  showDatums: true,
  showRoof: true,
  showPipes: true,
  showElectrical: true,
  showRoomLabels: true,
  wireframe: false,
  is2D: false,
};

export default function App() {
  const [options, setOptions] = useState<ViewOptions>(initialOptions);

  return (
    <EditorProvider floorId={options.floorId}>
      <ConstructionProvider>
        <AppShell options={options} onOptionsChange={setOptions} />
      </ConstructionProvider>
    </EditorProvider>
  );
}

function AppShell({
  options,
  onOptionsChange,
}: {
  options: ViewOptions;
  onOptionsChange: (next: ViewOptions) => void;
}) {
  const { floorPlan } = useEditor();
  const experience = options.appMode === "experience";
  useLiquidGlass();

  const setMode = (appMode: AppMode) => {
    onOptionsChange({ ...options, appMode });
  };

  return (
    // reducedMotion="user" defers to the system setting, the same way the
    // stylesheet's prefers-reduced-motion rules do.
    <MotionConfig reducedMotion="user">
      <div className={experience ? "app app-experience" : "app"}>
        <TitleBar />
        <div className="app-stage">
          <ModeSwitch mode={options.appMode} onChange={setMode} />
          {/* The two modes dissolve into each other. mode="wait" keeps them from
              overlapping, so only one WebGL canvas is ever live. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={options.appMode}
              className="stage-layer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={DISSOLVE}
            >
              {experience ? (
                <>
                  <ExperienceScene />
                  <aside className="experience-hud" aria-label="Experience">
                    <p className="view-kicker">Experience</p>
                    <h1>{floorPlan.name}</h1>
                    <p>{floorPlan.source.notes}</p>
                    <p>
                      Plumbing stacks, laterals, and electrical risers are live in
                      the model.
                    </p>
                  </aside>
                  <p className="experience-hint">Drag to explore · Scroll to zoom</p>
                </>
              ) : (
                <>
                  <Scene options={options} />
                  <LeftRail options={options} onChange={onOptionsChange} />
                  <DrawingCompare />
                  <div className="sheet-block">
                    <span className="sheet-no">{floorPlan.source.sheet}</span>
                    <strong>{floorPlan.source.title}</strong>
                    <span>{floorPlan.source.notes}</span>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
          {/* Outside the dissolve: both modes show these, and the chat would lose
              its transcript if switching modes remounted it. */}
          <ConstructionHud />
          <ChatPanel />
        </div>
      </div>
    </MotionConfig>
  );
}
