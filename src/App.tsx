import { useState } from "react";
import { ChatPanel } from "./components/ChatPanel";
import { ConstructionHud } from "./components/ConstructionHud";
import { ExperienceScene } from "./components/ExperienceScene";
import { Inspector } from "./components/Inspector";
import { ModeSwitch } from "./components/ModeSwitch";
import { Scene } from "./components/Scene";
import { ViewControls } from "./components/ViewControls";
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

  const setMode = (appMode: AppMode) => {
    onOptionsChange({ ...options, appMode });
  };

  return (
    <div className={experience ? "app app-experience" : "app"}>
      <ModeSwitch mode={options.appMode} onChange={setMode} />
      {experience ? (
        <>
          <ExperienceScene />
          <aside className="experience-hud" aria-label="Experience">
            <p className="view-kicker">Experience</p>
            <h1>{floorPlan.name}</h1>
            <p>{floorPlan.source.notes}</p>
            <p>Plumbing stacks, laterals, and electrical risers are live in the model.</p>
          </aside>
          <ConstructionHud />
          <ChatPanel />
          <p className="experience-hint">Drag to explore · Scroll to zoom</p>
        </>
      ) : (
        <>
          <Scene options={options} />
          <ViewControls
            floorPlan={floorPlan}
            options={options}
            onChange={onOptionsChange}
          />
          <Inspector />
          <ConstructionHud />
          <ChatPanel />
          <div className="sheet-block">
            <span className="sheet-no">{floorPlan.source.sheet}</span>
            <strong>{floorPlan.source.title}</strong>
            <span>{floorPlan.source.notes}</span>
          </div>
        </>
      )}
    </div>
  );
}
