import {
  presetsForSurface,
  swatchStyle,
  type MaterialPreset,
  type PresetSurface,
} from "../materials/presets";

interface MaterialPresetsProps {
  surface: PresetSurface;
  label: string;
  /** Off when the surrounding panel already names the picker. */
  showLabel?: boolean;
  activeId?: string | null;
  onPick: (preset: MaterialPreset) => void;
}

/**
 * The finish picker: a grid of swatches, each one a small drawing of the real
 * material. Clicking a swatch is the fast path; the sliders underneath stay for
 * anyone who wants to tune the result by hand.
 */
export function MaterialPresets({
  surface,
  label,
  showLabel = true,
  activeId,
  onPick,
}: MaterialPresetsProps) {
  const presets = presetsForSurface(surface);

  return (
    <section className="finish-picker" aria-label={label}>
      {showLabel ? <p className="finish-label">{label}</p> : null}
      <div className="finish-grid">
        {presets.map((preset) => {
          const active = preset.id === activeId;
          return (
            <button
              key={preset.id}
              type="button"
              className={active ? "finish-swatch is-active" : "finish-swatch"}
              aria-pressed={active}
              title={`${preset.name} — ${preset.note}`}
              onClick={() => onPick(preset)}
            >
              <span className="finish-chip" style={swatchStyle(preset)} aria-hidden="true" />
              <span className="finish-name">{preset.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
