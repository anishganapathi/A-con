import type { SelectableKind, SurfaceMaterial, Wall } from "../types/floorPlan";

export type PresetSurface = "facade" | "glazing" | "roof" | "interior" | "floor";

/**
 * How the swatch is drawn. Real finishes are not flat colours — brick reads as
 * courses, standing seam as ribs — so the thumbnail carries the pattern and the
 * eye can tell two grey metals apart.
 */
export type PresetPattern =
  | "flat"
  | "courses"
  | "seams"
  | "panels"
  | "grain"
  | "speckle"
  | "glass";

export interface MaterialPreset {
  id: string;
  name: string;
  surface: PresetSurface;
  pattern: PresetPattern;
  /** Tones for the thumbnail, lightest first. */
  swatch: string[];
  material: SurfaceMaterial;
  note: string;
}

/**
 * A hand-built library of architectural finishes. Values are physically-based
 * (roughness and metalness) rather than texture bitmaps, so nothing has to be
 * downloaded and the desktop build works offline.
 */
export const MATERIAL_PRESETS: MaterialPreset[] = [
  // Facade
  {
    id: "facade-concrete",
    name: "Board-formed concrete",
    surface: "facade",
    pattern: "speckle",
    swatch: ["#c6c1b8", "#b9b4ab", "#a49f96"],
    material: { color: "#b9b4ab", roughness: 0.92, metalness: 0.04, opacity: 1 },
    note: "Matte, grey, board marks",
  },
  {
    id: "facade-brick-red",
    name: "Red brick",
    surface: "facade",
    pattern: "courses",
    swatch: ["#b05a41", "#9c4a35", "#7d3a29"],
    material: { color: "#9c4a35", roughness: 0.88, metalness: 0.02, opacity: 1 },
    note: "Warm, coursed, domestic",
  },
  {
    id: "facade-limestone",
    name: "Buff limestone",
    surface: "facade",
    pattern: "courses",
    swatch: ["#e4dbc6", "#d8cdb4", "#c2b79d"],
    material: { color: "#d8cdb4", roughness: 0.85, metalness: 0.02, opacity: 1 },
    note: "Pale ashlar, civic",
  },
  {
    id: "facade-render",
    name: "White render",
    surface: "facade",
    pattern: "flat",
    swatch: ["#f4f2ed", "#ece9e2"],
    material: { color: "#ece9e2", roughness: 0.9, metalness: 0.01, opacity: 1 },
    note: "Smooth stucco, modern",
  },
  {
    id: "facade-corten",
    name: "Weathered steel",
    surface: "facade",
    pattern: "panels",
    swatch: ["#a25c34", "#8a4b2a", "#6b3a20"],
    material: { color: "#8a4b2a", roughness: 0.72, metalness: 0.35, opacity: 1 },
    note: "Corten, rusted orange",
  },
  {
    id: "facade-zinc",
    name: "Zinc panel",
    surface: "facade",
    pattern: "seams",
    swatch: ["#949aa1", "#7d838a", "#666c73"],
    material: { color: "#7d838a", roughness: 0.45, metalness: 0.6, opacity: 1 },
    note: "Grey metal, standing seam",
  },
  {
    id: "facade-aluminium",
    name: "Anodised aluminium",
    surface: "facade",
    pattern: "panels",
    swatch: ["#c2c7cb", "#a8adb2", "#8d9299"],
    // Architectural panel, not polished metal: anodising leaves a satin oxide
    // layer, and full metalness would mirror the sky into a black facade.
    material: { color: "#a8adb2", roughness: 0.34, metalness: 0.62, opacity: 1 },
    note: "Crisp, bright, commercial",
  },
  {
    id: "facade-curtain-wall",
    name: "Curtain wall glass",
    surface: "facade",
    pattern: "glass",
    swatch: ["#a9c6d4", "#86a6b8", "#5f8296"],
    material: { color: "#86a6b8", roughness: 0.08, metalness: 0.5, opacity: 0.55 },
    note: "Full glazing, tower",
  },
  {
    id: "facade-cedar",
    name: "Cedar cladding",
    surface: "facade",
    pattern: "grain",
    swatch: ["#c08d52", "#a9743f", "#8b5c30"],
    material: { color: "#a9743f", roughness: 0.8, metalness: 0.02, opacity: 1 },
    note: "Vertical timber boards",
  },
  {
    id: "facade-charred-timber",
    name: "Charred timber",
    surface: "facade",
    pattern: "grain",
    swatch: ["#413a34", "#2f2a26", "#1d1a17"],
    material: { color: "#2f2a26", roughness: 0.86, metalness: 0.03, opacity: 1 },
    note: "Shou sugi ban, near black",
  },
  {
    id: "facade-terracotta",
    name: "Terracotta baguette",
    surface: "facade",
    pattern: "seams",
    swatch: ["#c87249", "#b4603a", "#944c2c"],
    material: { color: "#b4603a", roughness: 0.82, metalness: 0.03, opacity: 1 },
    note: "Ceramic fins, warm",
  },
  {
    id: "facade-copper",
    name: "Patinated copper",
    surface: "facade",
    pattern: "speckle",
    swatch: ["#6aa694", "#4f8f7b", "#3b6f60"],
    material: { color: "#4f8f7b", roughness: 0.7, metalness: 0.4, opacity: 1 },
    note: "Green verdigris",
  },
  {
    id: "facade-black-steel",
    name: "Black steel panel",
    surface: "facade",
    pattern: "panels",
    swatch: ["#3c4146", "#2b2f33", "#1c1f22"],
    material: { color: "#2b2f33", roughness: 0.55, metalness: 0.55, opacity: 1 },
    note: "Dark, industrial",
  },
  {
    id: "facade-sandstone",
    name: "Sandstone",
    surface: "facade",
    pattern: "courses",
    swatch: ["#d9bd8f", "#c9a879", "#ab8b5f"],
    material: { color: "#c9a879", roughness: 0.87, metalness: 0.02, opacity: 1 },
    note: "Golden, heavy course",
  },

  // Glazing
  {
    id: "glazing-clear",
    name: "Clear low-E",
    surface: "glazing",
    pattern: "glass",
    swatch: ["#bfe0ee", "#9ecfe4", "#7bb6cf"],
    material: { color: "#9ecfe4", roughness: 0.06, metalness: 0.15, opacity: 0.3 },
    note: "Neutral, most daylight",
  },
  {
    id: "glazing-bronze",
    name: "Bronze tint",
    surface: "glazing",
    pattern: "glass",
    swatch: ["#a68a66", "#8a7355", "#6d5a42"],
    material: { color: "#8a7355", roughness: 0.1, metalness: 0.2, opacity: 0.42 },
    note: "Warm solar control",
  },
  {
    id: "glazing-reflective",
    name: "Reflective silver",
    surface: "glazing",
    pattern: "glass",
    swatch: ["#d3dde1", "#b9c6cc", "#98a8b0"],
    material: { color: "#b9c6cc", roughness: 0.05, metalness: 0.8, opacity: 0.5 },
    note: "Mirrored, hides interior",
  },
  {
    id: "glazing-fritted",
    name: "Fritted glass",
    surface: "glazing",
    pattern: "glass",
    swatch: ["#e3eef2", "#cfe0e6", "#b3c9d1"],
    material: { color: "#cfe0e6", roughness: 0.35, metalness: 0.1, opacity: 0.55 },
    note: "Dotted, diffuses light",
  },
  {
    id: "glazing-spandrel",
    name: "Spandrel panel",
    surface: "glazing",
    pattern: "flat",
    swatch: ["#48534f", "#37413f", "#262e2c"],
    material: { color: "#37413f", roughness: 0.4, metalness: 0.3, opacity: 0.95 },
    note: "Opaque, hides slab edge",
  },

  // Roof
  {
    id: "roof-standing-seam",
    name: "Standing seam steel",
    surface: "roof",
    pattern: "seams",
    swatch: ["#717c88", "#5b6570", "#464e57"],
    material: { color: "#5b6570", roughness: 0.38, metalness: 0.62, opacity: 1 },
    note: "Ribbed metal, pitched",
  },
  {
    id: "roof-membrane",
    name: "White membrane",
    surface: "roof",
    pattern: "flat",
    swatch: ["#f0f0ec", "#e6e6e2"],
    material: { color: "#e6e6e2", roughness: 0.85, metalness: 0.05, opacity: 1 },
    note: "TPO, reflects heat",
  },
  {
    id: "roof-clay-tile",
    name: "Clay tile",
    surface: "roof",
    pattern: "courses",
    swatch: ["#c25f38", "#a8502f", "#8a4125"],
    material: { color: "#a8502f", roughness: 0.8, metalness: 0.02, opacity: 1 },
    note: "Lapped pantiles",
  },
  {
    id: "roof-green",
    name: "Green roof",
    surface: "roof",
    pattern: "speckle",
    swatch: ["#6f9257", "#5c7d4a", "#46603a"],
    material: { color: "#5c7d4a", roughness: 0.95, metalness: 0, opacity: 1 },
    note: "Sedum, planted",
  },
  {
    id: "roof-zinc",
    name: "Zinc sheet",
    surface: "roof",
    pattern: "seams",
    swatch: ["#8a9098", "#767c83", "#5f656b"],
    material: { color: "#767c83", roughness: 0.42, metalness: 0.58, opacity: 1 },
    note: "Soft grey, matte metal",
  },

  // Interior
  {
    id: "interior-gypsum",
    name: "Painted gypsum",
    surface: "interior",
    pattern: "flat",
    swatch: ["#f6f3ed", "#f0ebe3"],
    material: { color: "#f0ebe3", roughness: 0.82, metalness: 0.02, opacity: 1 },
    note: "Standard partition",
  },
  {
    id: "interior-concrete",
    name: "Exposed concrete",
    surface: "interior",
    pattern: "speckle",
    swatch: ["#cfcbc4", "#c3bfb7", "#aeaaa2"],
    material: { color: "#c3bfb7", roughness: 0.88, metalness: 0.04, opacity: 1 },
    note: "Raw, loft",
  },
  {
    id: "interior-oak-panel",
    name: "Oak panelling",
    surface: "interior",
    pattern: "grain",
    swatch: ["#d3ab77", "#c39a63", "#a67f4c"],
    material: { color: "#c39a63", roughness: 0.7, metalness: 0.02, opacity: 1 },
    note: "Warm timber lining",
  },
  {
    id: "interior-glazed-partition",
    name: "Glazed partition",
    surface: "interior",
    pattern: "glass",
    swatch: ["#e0edf1", "#cfe0e6", "#b0c7d0"],
    material: { color: "#cfe0e6", roughness: 0.1, metalness: 0.2, opacity: 0.35 },
    note: "Office fronts, open feel",
  },
  {
    id: "interior-dark-panel",
    name: "Dark acoustic panel",
    surface: "interior",
    pattern: "panels",
    swatch: ["#575e5c", "#454b49", "#333837"],
    material: { color: "#454b49", roughness: 0.95, metalness: 0.02, opacity: 1 },
    note: "Soft, absorbs sound",
  },

  // Floor
  {
    id: "floor-polished-concrete",
    name: "Polished concrete",
    surface: "floor",
    pattern: "speckle",
    swatch: ["#c6c3bb", "#b9b6ae", "#a5a29a"],
    material: { color: "#b9b6ae", roughness: 0.35, metalness: 0.08, opacity: 1 },
    note: "Sealed, slight sheen",
  },
  {
    id: "floor-oak-boards",
    name: "Oak boards",
    surface: "floor",
    pattern: "grain",
    swatch: ["#cf9d64", "#c08d54", "#a0703e"],
    material: { color: "#c08d54", roughness: 0.6, metalness: 0.02, opacity: 1 },
    note: "Timber planks",
  },
  {
    id: "floor-terrazzo",
    name: "Terrazzo",
    surface: "floor",
    pattern: "speckle",
    swatch: ["#e4dfd4", "#d8d2c6", "#bcb6a9"],
    material: { color: "#d8d2c6", roughness: 0.4, metalness: 0.05, opacity: 1 },
    note: "Chipped stone, civic",
  },
  {
    id: "floor-carpet-tile",
    name: "Carpet tile",
    surface: "floor",
    pattern: "panels",
    swatch: ["#7f8a86", "#6f7a76", "#5c6663"],
    material: { color: "#6f7a76", roughness: 0.95, metalness: 0, opacity: 1 },
    note: "Office, quiet",
  },
  {
    id: "floor-ceramic-tile",
    name: "Ceramic tile",
    surface: "floor",
    pattern: "panels",
    swatch: ["#e6e3dd", "#dcd9d2", "#c4c1ba"],
    material: { color: "#dcd9d2", roughness: 0.25, metalness: 0.05, opacity: 1 },
    note: "Wet rooms, gridded",
  },
];

/** How close a material has to be to count as still wearing a preset. */
const MATCH_EPSILON = 0.02;

export function presetsForSurface(surface: PresetSurface): MaterialPreset[] {
  return MATERIAL_PRESETS.filter((preset) => preset.surface === surface);
}

/**
 * Which finishes to offer for whatever is selected. Pipe and conduit colours are
 * a system code — supply copper, waste grey — not a finish, so they get none.
 */
export function surfaceForSelection(
  kind: SelectableKind,
  wallType?: Wall["type"],
): PresetSurface | null {
  switch (kind) {
    case "wall":
      return wallType === "exterior" ? "facade" : "interior";
    case "opening":
      return "glazing";
    case "room":
      return "floor";
    default:
      return null;
  }
}

/** The preset a material came from, so the picker can show what is in use. */
export function matchPreset(
  material: SurfaceMaterial,
  surface: PresetSurface,
): MaterialPreset | null {
  const color = material.color.toLowerCase();
  return (
    presetsForSurface(surface).find(
      (preset) =>
        preset.material.color.toLowerCase() === color &&
        Math.abs(preset.material.roughness - material.roughness) <= MATCH_EPSILON &&
        Math.abs(preset.material.metalness - material.metalness) <= MATCH_EPSILON,
    ) ?? null
  );
}

/**
 * The thumbnail, built from CSS gradients rather than an image file: it stays
 * sharp at any size, costs no download, and survives the desktop build's
 * self-only content policy.
 */
export function swatchStyle(preset: MaterialPreset): { background: string } {
  const [light, mid, dark] = [
    preset.swatch[0],
    preset.swatch[1] ?? preset.swatch[0],
    preset.swatch[2] ?? preset.swatch[1] ?? preset.swatch[0],
  ];
  const base = `linear-gradient(150deg, ${light}, ${mid} 55%, ${dark})`;

  switch (preset.pattern) {
    case "courses":
      return {
        background: `repeating-linear-gradient(180deg, ${dark} 0 1px, transparent 1px 5px), ${base}`,
      };
    case "seams":
      return {
        background: `repeating-linear-gradient(90deg, ${dark} 0 1px, transparent 1px 4px), ${base}`,
      };
    case "panels":
      return {
        background: `repeating-linear-gradient(90deg, ${dark} 0 1px, transparent 1px 9px), repeating-linear-gradient(180deg, ${dark} 0 1px, transparent 1px 9px), ${base}`,
      };
    case "grain":
      return {
        background: `repeating-linear-gradient(92deg, ${dark} 0 1px, transparent 1px 3px), ${base}`,
      };
    case "speckle":
      return {
        background: `radial-gradient(circle at 30% 25%, ${light} 0 1px, transparent 2px), radial-gradient(circle at 70% 60%, ${dark} 0 1px, transparent 2px), radial-gradient(circle at 45% 80%, ${light} 0 1px, transparent 2px), ${base}`,
      };
    case "glass":
      return {
        background: `linear-gradient(120deg, transparent 40%, ${light} 46%, transparent 52%), linear-gradient(160deg, ${mid}, ${dark})`,
      };
    default:
      return { background: base };
  }
}
