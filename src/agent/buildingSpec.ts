import type { Point2D } from "../types/floorPlan";

export type BuildingTypology =
  | "residential"
  | "retail"
  | "warehouse"
  | "office"
  | "civic";

export type ZoneKind =
  | "entry"
  | "sales"
  | "service"
  | "back"
  | "wet"
  | "circulation"
  | "living"
  | "work";

export interface ZoneSpec {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: ZoneKind;
  /** Set for GIS-derived plates, where zones follow the real footprint. */
  polygon?: Point2D[];
}

/** Measured facts from a real building, kept separate from synthesized layout. */
export interface SurveySource {
  provider: string;
  address: string;
  bbl: string;
  bin: string;
  yearBuilt: number | null;
  bldgClass: string | null;
  latitude: number;
  longitude: number;
  heightEstimated: boolean;
  attribution: string;
}

export interface BuildingSpec {
  name: string;
  reference?: string;
  typology: BuildingTypology;
  width: number;
  depth: number;
  stories: number;
  storyHeight: number;
  roof: "flat" | "standing-seam";
  exteriorColor?: string;
  includeMep: boolean;
  notes?: string;
  project?: string;
  zones: ZoneSpec[];
  /** Real footprint ring in meters, origin at the bounding-box corner. */
  footprint?: Point2D[];
  /** Gross floor area in m² from the tax record, used to derive setbacks. */
  grossFloorAreaM2?: number;
  /** Surveyed setback volumes; when present they replace the inferred taper. */
  massing?: MassingVolume[];
  /** Structural top including spire or mast, in meters. */
  tipHeight?: number;
  survey?: SurveySource;
}

export interface MassingVolume {
  id: string;
  polygon: Point2D[];
  minHeight: number;
  maxHeight: number;
  roofShape: string | null;
  roofHeight: number;
}

/**
 * The plate at a given elevation is the largest volume spanning it. Smaller
 * concurrent volumes (lift spines, the mast shaft) sit inside the envelope,
 * so taking the largest reproduces the silhouette without polygon unions.
 */
export function plateAtElevation(
  massing: MassingVolume[],
  elevation: number,
): MassingVolume | null {
  let best: MassingVolume | null = null;
  for (const volume of massing) {
    if (elevation < volume.minHeight - 0.01 || elevation >= volume.maxHeight) {
      continue;
    }
    if (!best || polygonArea(volume.polygon) > polygonArea(best.polygon)) {
      best = volume;
    }
  }
  return best;
}

const MAX_STORIES = 120;

export function normalizeSpec(raw: Partial<BuildingSpec> | undefined): BuildingSpec {
  const typology = raw?.typology ?? "residential";
  const footprint = normalizeFootprint(raw?.footprint);
  const surveyed = Boolean(footprint);

  // Synthesized buildings stay in a sane envelope; surveyed ones use real values.
  const bbox = footprint ? footprintBounds(footprint) : null;
  const width = bbox
    ? bbox.width
    : clamp(raw?.width ?? defaultSize(typology).width, 8, 120);
  const depth = bbox
    ? bbox.depth
    : clamp(raw?.depth ?? defaultSize(typology).depth, 8, 90);
  const storyCap = surveyed ? MAX_STORIES : 12;
  const stories = Math.min(
    storyCap,
    Math.max(1, Math.round(raw?.stories ?? 1)),
  );
  const storyHeight = clamp(
    raw?.storyHeight ?? defaultSize(typology).storyHeight,
    2.4,
    14,
  );
  const zones = (raw?.zones ?? [])
    .map((zone, index) => normalizeZone(zone, index, width, depth))
    .filter((zone) => zone.w >= 1.5 && zone.h >= 1.5);

  const fallbackZones = footprint
    ? coreAndRingZones(footprint, typology, stories)
    : layoutZones(typology, width, depth, raw?.reference);

  return {
    name: raw?.name?.trim() || raw?.reference?.trim() || "New building",
    reference: raw?.reference,
    typology,
    width,
    depth,
    stories,
    storyHeight,
    roof: raw?.roof ?? (typology === "residential" && !surveyed ? "standing-seam" : "flat"),
    exteriorColor: raw?.exteriorColor,
    includeMep: raw?.includeMep ?? true,
    notes: raw?.notes,
    project: raw?.project ?? raw?.name,
    zones: zones.length > 0 ? zones : fallbackZones,
    footprint,
    grossFloorAreaM2: raw?.grossFloorAreaM2,
    massing: raw?.massing,
    tipHeight: raw?.tipHeight,
    survey: raw?.survey,
  };
}

export function polygonArea(points: Point2D[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum / 2);
}

export function scalePolygon(points: Point2D[], scale: number): Point2D[] {
  const centroid = polygonCentroid(points);
  return points.map((point) => ({
    x: round(centroid.x + (point.x - centroid.x) * scale),
    y: round(centroid.y + (point.y - centroid.y) * scale),
  }));
}

/**
 * Footprints are 2D, so a tower would otherwise extrude its base straight up.
 * The tax record's gross floor area is the only public signal for setbacks:
 * when it falls well short of footprint x storeys, the upper floors must be
 * smaller. Returns a per-floor linear scale that spends the area budget.
 */
export function plateScales(
  footprint: Point2D[],
  stories: number,
  grossFloorAreaM2: number | undefined,
): number[] {
  const full = new Array<number>(stories).fill(1);
  const plate = polygonArea(footprint);
  if (!grossFloorAreaM2 || grossFloorAreaM2 <= 0 || plate <= 0 || stories < 6) {
    return full;
  }

  const straightTotal = plate * stories;
  // Within ~15% of a straight extrusion means no meaningful setback.
  if (grossFloorAreaM2 > straightTotal * 0.85) {
    return full;
  }

  const baseFloors = Math.max(2, Math.round(stories * 0.06));
  const midFloors = Math.max(2, Math.round(stories * 0.14));
  const towerFloors = stories - baseFloors - midFloors;
  if (towerFloors <= 0) {
    return full;
  }

  // Solve k for: base*A + mid*A*m² + tower*A*k² = target, with m midway.
  const remaining = grossFloorAreaM2 - baseFloors * plate;
  if (remaining <= 0) {
    return full.map((_, index) => (index < baseFloors ? 1 : 0.45));
  }
  // m = (1 + k) / 2  =>  m² = (1 + 2k + k²) / 4
  const a = towerFloors + midFloors / 4;
  const b = midFloors / 2;
  const c = midFloors / 4 - remaining / plate;
  const disc = b * b - 4 * a * c;
  const k = disc > 0 ? (-b + Math.sqrt(disc)) / (2 * a) : 0.45;
  const tower = clamp(k, 0.28, 1);
  const mid = clamp((1 + tower) / 2, tower, 1);

  return full.map((_, index) => {
    if (index < baseFloors) {
      return 1;
    }
    return index < baseFloors + midFloors ? mid : tower;
  });
}

function normalizeFootprint(raw: Point2D[] | undefined): Point2D[] | undefined {
  if (!raw || raw.length < 4) {
    return undefined;
  }
  const points = raw
    .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
    .map((point) => ({ x: point.x, y: point.y }));
  return points.length >= 4 ? points : undefined;
}

export function footprintBounds(points: Point2D[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    depth: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
}

/**
 * Real buildings are laid out as a service core wrapped by tenant space, so a
 * surveyed footprint gets a scaled-in core and one perimeter bay per facade.
 * Interior partitioning is never published; this is a plausible reconstruction.
 */
export function coreAndRingZones(
  footprint: Point2D[],
  typology: BuildingTypology,
  stories: number,
): ZoneSpec[] {
  const centroid = polygonCentroid(footprint);
  // Service cores run roughly a fifth of the plate in an office tower and less
  // in residential, where the leasable perimeter is worth more.
  const coreFraction = typology === "residential" ? 0.14 : stories > 12 ? 0.22 : 0.18;
  const scale = clamp(Math.sqrt(coreFraction), 0.2, 0.62);
  const core = scalePolygon(footprint, scale);

  const tenantName = tenantLabel(typology);
  const zones: ZoneSpec[] = [];

  // Tall plates get four grouped facades; low plates get a bay per edge.
  const grouped = stories > 12 || footprint.length > 8;
  const bays = grouped
    ? groupRingByFacade(footprint, core, centroid)
    : footprint.map((point, index) => ({
        polygon: [
          point,
          footprint[(index + 1) % footprint.length],
          core[(index + 1) % core.length],
          core[index],
        ],
        label: `${compass(point, footprint[(index + 1) % footprint.length], centroid)} ${tenantName}`,
      }));

  bays.forEach((bay, index) => {
    zones.push({
      id: `bay-${index + 1}`,
      name: bay.label,
      kind: typology === "residential" ? "living" : "work",
      polygon: bay.polygon,
      ...rectOf(bay.polygon),
    });
  });

  zones.push({
    id: "core",
    name: "Elevator Core & Stairs",
    kind: "circulation",
    polygon: core,
    ...rectOf(core),
  });

  // Wet stack sits inside the core; keep it small so it reads as a shaft
  // rather than a second room competing with the elevator lobby.
  const coreBounds = footprintBounds(core);
  const shaftW = clamp(coreBounds.width * 0.3, 2, 9);
  const shaftH = clamp(coreBounds.depth * 0.3, 2, 9);
  const shaft: Point2D[] = [
    { x: round(coreBounds.centerX - shaftW / 2), y: round(coreBounds.centerY - shaftH / 2) },
    { x: round(coreBounds.centerX + shaftW / 2), y: round(coreBounds.centerY - shaftH / 2) },
    { x: round(coreBounds.centerX + shaftW / 2), y: round(coreBounds.centerY + shaftH / 2) },
    { x: round(coreBounds.centerX - shaftW / 2), y: round(coreBounds.centerY + shaftH / 2) },
  ];
  zones.push({
    id: "core-service",
    name: "Restrooms & MEP Shaft",
    kind: "wet",
    polygon: shaft,
    ...rectOf(shaft),
  });

  return zones;
}

interface RingBay {
  polygon: Point2D[];
  label: string;
}

/** Collapses a many-sided ring into north/east/south/west perimeter bays. */
function groupRingByFacade(
  footprint: Point2D[],
  core: Point2D[],
  centroid: Point2D,
): RingBay[] {
  const buckets: Record<string, number[]> = { North: [], East: [], South: [], West: [] };
  for (let i = 0; i < footprint.length; i += 1) {
    const a = footprint[i];
    const b = footprint[(i + 1) % footprint.length];
    buckets[compass(a, b, centroid)].push(i);
  }

  const bays: RingBay[] = [];
  for (const [name, indices] of Object.entries(buckets)) {
    if (indices.length === 0) {
      continue;
    }
    // Keep each facade contiguous so the bay stays a simple polygon.
    for (const run of contiguousRuns(indices, footprint.length)) {
      const outer = run.map((index) => footprint[index]);
      outer.push(footprint[(run[run.length - 1] + 1) % footprint.length]);
      const inner = run.map((index) => core[index]);
      inner.push(core[(run[run.length - 1] + 1) % core.length]);
      bays.push({
        polygon: [...outer, ...inner.reverse()],
        label: `${name} Perimeter`,
      });
    }
  }
  return bays.length > 0 ? bays : [];
}

function contiguousRuns(indices: number[], total: number): number[][] {
  const sorted = [...indices].sort((a, b) => a - b);
  const runs: number[][] = [];
  let current: number[] = [];
  for (const index of sorted) {
    if (current.length === 0 || index === current[current.length - 1] + 1) {
      current.push(index);
    } else {
      runs.push(current);
      current = [index];
    }
  }
  if (current.length > 0) {
    runs.push(current);
  }
  // Merge a run that wraps past the last vertex back onto the first.
  if (
    runs.length > 1 &&
    runs[0][0] === 0 &&
    runs[runs.length - 1][runs[runs.length - 1].length - 1] === total - 1
  ) {
    const last = runs.pop();
    if (last) {
      runs[0] = [...last, ...runs[0]];
    }
  }
  return runs;
}

function compass(a: Point2D, b: Point2D, centroid: Point2D): "North" | "East" | "South" | "West" {
  const midX = (a.x + b.x) / 2 - centroid.x;
  const midY = (a.y + b.y) / 2 - centroid.y;
  if (Math.abs(midY) >= Math.abs(midX)) {
    return midY >= 0 ? "North" : "South";
  }
  return midX >= 0 ? "East" : "West";
}

function tenantLabel(typology: BuildingTypology): string {
  if (typology === "office") {
    return "Office Wing";
  }
  if (typology === "retail") {
    return "Sales Floor";
  }
  if (typology === "warehouse") {
    return "Rack Hall";
  }
  if (typology === "civic") {
    return "Public Hall";
  }
  return "Residences";
}

function polygonCentroid(points: Point2D[]): Point2D {
  let area = 0;
  let x = 0;
  let y = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    x += (a.x + b.x) * cross;
    y += (a.y + b.y) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-6) {
    const bounds = footprintBounds(points);
    return { x: bounds.centerX, y: bounds.centerY };
  }
  return { x: x / (6 * area), y: y / (6 * area) };
}

function rectOf(points: Point2D[]): { x: number; y: number; w: number; h: number } {
  const bounds = footprintBounds(points);
  return {
    x: round(bounds.minX),
    y: round(bounds.minY),
    w: round(Math.max(bounds.width, 0.1)),
    h: round(Math.max(bounds.depth, 0.1)),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function inferSpecFromPrompt(text: string): BuildingSpec {
  const typology = detectTypology(text);
  const size = defaultSize(typology);
  const measured = text.match(/(\d+(?:\.\d+)?)\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)/i);
  const width = measured ? Number(measured[1]) : size.width;
  const depth = measured ? Number(measured[2]) : size.depth;
  const storiesMatch = text.match(/(\d+)\s*(?:stor(?:y|ies)|floor)/i);
  const reference = detectReference(text);
  return normalizeSpec({
    name: reference ?? "New building",
    reference: reference ?? undefined,
    typology,
    width,
    depth,
    stories: storiesMatch ? Number(storiesMatch[1]) : size.stories,
    storyHeight: size.storyHeight,
    includeMep: !/no mep|without (?:pipes|electrical)/i.test(text),
    notes: `Interpreted from: ${text.trim()}`,
    zones: layoutZones(typology, width, depth, reference ?? text),
  });
}

function detectTypology(text: string): BuildingTypology {
  if (/walmart|costco|target|supercenter|supermarket|grocery|retail|mall|store|shop|commercial/i.test(text)) {
    return "retail";
  }
  if (/warehouse|distribution|fulfillment|logistics/i.test(text)) {
    return "warehouse";
  }
  if (/office|headquarters|cowork/i.test(text)) {
    return "office";
  }
  if (/school|hospital|library|civic|clinic/i.test(text)) {
    return "civic";
  }
  return "residential";
}

function detectReference(text: string): string | null {
  const like = text.match(/(?:like|just like|similar to)\s+([A-Za-z0-9&.' -]{2,40})/i);
  if (like?.[1]) {
    return like[1].replace(/[.,!]+$/, "").trim();
  }
  if (/walmart/i.test(text)) {
    return "Walmart Supercenter";
  }
  return null;
}

function defaultSize(typology: BuildingTypology) {
  if (typology === "retail") {
    return { width: 72, depth: 48, stories: 1, storyHeight: 7.2 };
  }
  if (typology === "warehouse") {
    return { width: 80, depth: 52, stories: 1, storyHeight: 9 };
  }
  if (typology === "office") {
    return { width: 36, depth: 24, stories: 3, storyHeight: 3.6 };
  }
  if (typology === "civic") {
    return { width: 40, depth: 28, stories: 2, storyHeight: 4.2 };
  }
  return { width: 12, depth: 9, stories: 2, storyHeight: 3.2 };
}

export function layoutZones(
  typology: BuildingTypology,
  width: number,
  depth: number,
  hint?: string,
): ZoneSpec[] {
  if (typology === "retail") {
    return packZones(width, depth, retailDepartments(hint));
  }
  if (typology === "warehouse") {
    return packZones(width, depth, [
      ["entry", "entry", 0.12],
      ["office", "work", 0.1],
      ["staging", "back", 0.18],
      ["rack-aisles", "sales", 0.48],
      ["dock", "back", 0.12],
    ]);
  }
  if (typology === "office") {
    return packZones(width, depth, [
      ["lobby", "entry", 0.14],
      ["open-office", "work", 0.42],
      ["meeting", "service", 0.16],
      ["amenities", "wet", 0.1],
      ["core", "circulation", 0.18],
    ]);
  }
  if (typology === "civic") {
    return packZones(width, depth, [
      ["lobby", "entry", 0.16],
      ["public-hall", "sales", 0.38],
      ["admin", "work", 0.2],
      ["restrooms", "wet", 0.1],
      ["service", "back", 0.16],
    ]);
  }
  return packZones(width, depth, [
    ["living", "living", 0.32],
    ["kitchen", "wet", 0.14],
    ["bedroom-1", "living", 0.16],
    ["bedroom-2", "living", 0.16],
    ["bath", "wet", 0.1],
    ["hall", "circulation", 0.12],
  ]);
}

function retailDepartments(hint?: string): [string, ZoneKind, number][] {
  const extra: [string, ZoneKind, number][] = [];
  if (hint && /garden|outdoor/i.test(hint)) {
    extra.push(["garden-center", "sales", 0.08]);
  }
  if (hint && /pharmacy|health/i.test(hint)) {
    extra.push(["pharmacy", "service", 0.06]);
  }
  return [
    ["vestibule", "entry", 0.08],
    ["checkout", "service", 0.12],
    ["grocery", "sales", 0.22],
    ["hba", "sales", 0.08],
    ["apparel", "sales", 0.12],
    ["electronics", "sales", 0.08],
    ["home", "sales", 0.1],
    ["restrooms", "wet", 0.05],
    ["receiving", "back", 0.15],
    ...extra,
  ];
}

function packZones(
  width: number,
  depth: number,
  items: [string, ZoneKind, number][],
): ZoneSpec[] {
  const total = items.reduce((sum, item) => sum + item[2], 0);
  const frontDepth = Math.min(depth * 0.22, 10);
  const salesDepth = depth - frontDepth;
  const zones: ZoneSpec[] = [];
  let x = 0;
  const front = items.slice(0, Math.min(2, items.length));
  const rest = items.slice(front.length);
  const frontWeight = front.reduce((sum, item) => sum + item[2], 0) || 1;

  for (const [name, kind, weight] of front) {
    const w = (weight / frontWeight) * width;
    zones.push({
      id: slug(name),
      name: title(name),
      x: snap(x),
      y: 0,
      w: snap(w),
      h: snap(frontDepth),
      kind,
    });
    x += w;
  }

  x = 0;
  const restWeight = rest.reduce((sum, item) => sum + item[2], 0) || total;
  for (const [name, kind, weight] of rest) {
    const w = (weight / restWeight) * width;
    zones.push({
      id: slug(name),
      name: title(name),
      x: snap(x),
      y: snap(frontDepth),
      w: snap(Math.max(3, w)),
      h: snap(salesDepth),
      kind,
    });
    x += w;
  }
  return zones;
}

function normalizeZone(
  zone: Partial<ZoneSpec>,
  index: number,
  width: number,
  depth: number,
): ZoneSpec {
  const x = clamp(zone.x ?? 0, 0, width - 1.5);
  const y = clamp(zone.y ?? 0, 0, depth - 1.5);
  return {
    id: zone.id?.trim() || `zone-${index + 1}`,
    name: zone.name?.trim() || `Zone ${index + 1}`,
    x: snap(x),
    y: snap(y),
    w: snap(clamp(zone.w ?? 4, 1.5, width - x)),
    h: snap(clamp(zone.h ?? 4, 1.5, depth - y)),
    kind: zone.kind ?? "sales",
  };
}

function snap(value: number): number {
  return Math.round(value * 20) / 20;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function title(value: string): string {
  return value
    .split("-")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}
