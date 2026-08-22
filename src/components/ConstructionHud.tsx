import { useConstruction } from "../editor/ConstructionContext";

export function ConstructionHud() {
  const construction = useConstruction();
  if (!construction.playing && construction.phase === "complete") {
    return null;
  }

  return (
    <div className="construction-hud" aria-live="polite">
      <p className="view-kicker">Live construction</p>
      <strong>{construction.label}</strong>
      <div className="construction-bar">
        <span style={{ width: `${Math.round(construction.progress * 100)}%` }} />
      </div>
    </div>
  );
}
