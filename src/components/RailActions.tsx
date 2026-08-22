import { useEditor } from "../editor/EditorContext";

/**
 * Undo, redo and reset. Pinned below the trays rather than filed inside one,
 * because they act on the model whichever section happens to be open.
 */
export function RailActions() {
  const { resetPlan, undo, redo, canUndo, canRedo } = useEditor();

  return (
    <div className="rail-footer">
      <div className="history-actions">
        <button type="button" className="btn-ghost" onClick={undo} disabled={!canUndo}>
          Undo
        </button>
        <button type="button" className="btn-ghost" onClick={redo} disabled={!canRedo}>
          Redo
        </button>
      </div>
      <button type="button" className="btn-ghost reset-plan" onClick={resetPlan}>
        Reset plan
      </button>
    </div>
  );
}
