import type { Point2D } from "../types/floorPlan";
import type { BuildingSpec, GlazingSpec } from "./buildingSpec";

export interface SpecOption {
  id: string;
  label: string;
  detail: string;
  /** Marks the model's own proposal, offered as the middle option. */
  recommended?: boolean;
  patch: Partial<BuildingSpec>;
}

export interface SpecQuestion {
  id: "footprint" | "height" | "windows";
  prompt: string;
  options: SpecOption[];
}

/** How far the compact and generous variants sit either side of the proposal. */
const SIZE_STEP = 0.7;
const SIZE_STRETCH = 1.35;

/**
 * The questions asked before a building is committed. The model's own numbers
 * are always the middle option so accepting the suggestion is one click, with a
 * smaller and a larger variant either side.
 */
export function buildSpecQuestions(spec: BuildingSpec): SpecQuestion[] {
  // A surveyed building's envelope is measured, not chosen.
  if (spec.survey) {
    return [];
  }
  return [footprintQuestion(spec), heightQuestion(spec), windowQuestion(spec)];
}

function footprintQuestion(spec: BuildingSpec): SpecQuestion {
  const sizes: { key: string; name: string; scale: number }[] = [
    { key: "compact", name: "Compact", scale: SIZE_STEP },
    { key: "suggested", name: "Suggested", scale: 1 },
    { key: "generous", name: "Generous", scale: SIZE_STRETCH },
  ];

  return {
    id: "footprint",
    prompt: "How big should the footprint be?",
    options: sizes.map(({ key, name, scale }) => {
      const width = round(spec.width * scale);
      const depth = round(spec.depth * scale);
      return {
        id: `footprint-${key}`,
        label: `${name} · ${width} × ${depth} m`,
        detail: `${Math.round(width * depth)} m² per floor`,
        recommended: scale === 1,
        patch: { width, depth },
      };
    }),
  };
}

function heightQuestion(spec: BuildingSpec): SpecQuestion {
  const steps = [
    { key: "low", stories: Math.max(1, Math.round(spec.stories * 0.6)) },
    { key: "mid", stories: spec.stories },
    { key: "tall", stories: Math.round(spec.stories * 1.6) },
  ];
  // A proposal of 1 or 2 storeys collapses the variants onto the suggestion,
  // so they are spread by hand to keep three distinct choices.
  const spread = dedupeStories(steps.map((step) => step.stories));

  return {
    id: "height",
    prompt: "How tall should it stand?",
    options: steps.map((step, index) => {
      const stories = spread[index];
      const storyHeight = spec.storyHeight;
      // The spread can shift off the proposal for a one- or two-storey draft,
      // so the name follows the number rather than the slot it sits in.
      const suggested = stories === spec.stories;
      const name = suggested ? "Suggested" : stories < spec.stories ? "Lower" : "Taller";
      return {
        id: `height-${step.key}`,
        label: `${name} · ${stories} ${stories === 1 ? "storey" : "storeys"}`,
        detail: `${round(stories * storyHeight)} m to the roof`,
        recommended: suggested,
        patch: { stories, storyHeight },
      };
    }),
  };
}

function windowQuestion(spec: BuildingSpec): SpecQuestion {
  const retail = spec.typology === "retail" || spec.typology === "warehouse";
  const sizes: { key: string; name: string; width: number; height: number; sill: number }[] = [
    { key: "punched", name: "Punched", width: 1.4, height: 1.3, sill: 0.95 },
    retail
      ? { key: "wide", name: "Wide", width: 2.4, height: 1.8, sill: 1.4 }
      : { key: "wide", name: "Wide", width: 2.4, height: 1.8, sill: 0.75 },
    { key: "glazed", name: "Full height", width: 4.2, height: 2.8, sill: 0.35 },
  ];

  return {
    id: "windows",
    prompt: "What size should the windows be?",
    options: sizes.map((size) => {
      const windows = fitGlazing(
        { width: size.width, height: size.height, sillHeight: size.sill },
        spec.storyHeight,
      );
      return {
        id: `windows-${size.key}`,
        label: `${size.name} · ${windows.width} × ${windows.height} m`,
        detail: `${windows.sillHeight} m sill`,
        recommended: size.key === "wide",
        patch: { windows },
      };
    }),
  };
}

/**
 * Glazing has to clear the floor and stop short of the slab above, otherwise
 * the opening is cut through the head of the wall.
 */
function fitGlazing(glazing: GlazingSpec, storyHeight: number): GlazingSpec {
  const headroom = Math.max(0.6, storyHeight - 0.4);
  let sillHeight = Math.min(glazing.sillHeight, headroom * 0.5);
  let height = glazing.height;
  if (sillHeight + height > headroom) {
    height = round(Math.max(0.5, headroom - sillHeight));
  }
  if (height < 0.5) {
    height = 0.5;
    sillHeight = round(Math.max(0, headroom - height));
  }
  return { width: glazing.width, height: round(height), sillHeight: round(sillHeight) };
}

export function applySpecChoice(
  spec: BuildingSpec,
  patch: Partial<BuildingSpec>,
): BuildingSpec {
  const next: BuildingSpec = { ...spec, ...patch };
  const resized = patch.width !== undefined || patch.depth !== undefined;
  if (!resized) {
    return next;
  }

  // compileSpec draws the plate from `footprint` when it exists, so a new width
  // and depth would otherwise be ignored. The outline and every massing band
  // scale by the same factors to keep the authored shape.
  const scaleX = spec.width > 0 ? next.width / spec.width : 1;
  const scaleY = spec.depth > 0 ? next.depth / spec.depth : 1;
  if (spec.footprint) {
    next.footprint = scaleRing(spec.footprint, scaleX, scaleY);
  }
  if (spec.massing) {
    next.massing = spec.massing.map((band) => ({
      ...band,
      polygon: scaleRing(band.polygon, scaleX, scaleY),
    }));
  }
  return next;
}

function scaleRing(ring: Point2D[], scaleX: number, scaleY: number): Point2D[] {
  return ring.map((point) => ({
    x: round(point.x * scaleX, 3),
    y: round(point.y * scaleY, 3),
  }));
}

function dedupeStories(stories: number[]): number[] {
  const [low, mid, high] = stories;
  const spread = [low, mid, high];
  if (spread[0] >= spread[1]) {
    spread[0] = Math.max(1, spread[1] - 1);
  }
  if (spread[2] <= spread[1]) {
    spread[2] = spread[1] + 1;
  }
  // A 1-storey proposal has no room below it, so the trio shifts upward.
  if (spread[0] === spread[1]) {
    spread[1] = spread[0] + 1;
    spread[2] = Math.max(spread[2], spread[1] + 1);
  }
  return spread;
}

function round(value: number, places = 1): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
