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
}

export function normalizeSpec(raw: Partial<BuildingSpec> | undefined): BuildingSpec {
  const typology = raw?.typology ?? "residential";
  const width = clamp(raw?.width ?? defaultSize(typology).width, 8, 120);
  const depth = clamp(raw?.depth ?? defaultSize(typology).depth, 8, 90);
  const stories = Math.min(4, Math.max(1, Math.round(raw?.stories ?? 1)));
  const storyHeight = clamp(
    raw?.storyHeight ?? defaultSize(typology).storyHeight,
    2.6,
    12,
  );
  const zones = (raw?.zones ?? [])
    .map((zone, index) => normalizeZone(zone, index, width, depth))
    .filter((zone) => zone.w >= 1.5 && zone.h >= 1.5);

  return {
    name: raw?.name?.trim() || raw?.reference?.trim() || "New building",
    reference: raw?.reference,
    typology,
    width,
    depth,
    stories,
    storyHeight,
    roof: raw?.roof ?? (typology === "residential" ? "standing-seam" : "flat"),
    exteriorColor: raw?.exteriorColor,
    includeMep: raw?.includeMep ?? true,
    notes: raw?.notes,
    project: raw?.project ?? raw?.name,
    zones: zones.length > 0 ? zones : layoutZones(typology, width, depth, raw?.reference),
  };
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
