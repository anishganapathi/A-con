import type {
  Floor,
  FloorPlan,
  Opening,
  Room,
  Wall,
} from "../types/floorPlan";
import type { BuildingSpec, MassingVolume, ZoneKind, ZoneSpec } from "./buildingSpec";
import {
  coreAndRingZones,
  normalizeSpec,
  plateAtElevation,
  plateScales,
  scalePolygon,
} from "./buildingSpec";
import type { MepPlan } from "./mepLayout";
import { planElectrical, planPipes, riserAnchorFor } from "./mepLayout";

/**
 * Above this floor count the plate is emitted at reduced detail so the scene
 * stays interactive — a 100-storey tower is ~30x the geometry of a big-box.
 */
const DENSE_DETAIL_MAX_STORIES = 12;

export function compileSpec(raw: Partial<BuildingSpec>): FloorPlan {
  const spec = normalizeSpec(raw);
  const dense = spec.stories <= DENSE_DETAIL_MAX_STORIES;
  const surveyedMassing = spec.massing && spec.massing.length > 0 ? spec.massing : null;
  const scales =
    spec.footprint && !surveyedMassing
      ? plateScales(spec.footprint, spec.stories, spec.grossFloorAreaM2)
      : [];

  // Surveyed massing may continue past the top occupiable floor as a crown or
  // mast; those levels are modelled too so the silhouette is right.
  const occupiable = spec.stories;
  const spireTop = surveyedMassing
    ? Math.max(...surveyedMassing.map((volume) => volume.maxHeight))
    : 0;
  const totalLevels = surveyedMassing
    ? Math.max(occupiable, Math.ceil(spireTop / spec.storyHeight))
    : occupiable;

  // Risers are only continuous if every floor drops them at the same point, so
  // the shaft is set out once against the tightest plate the building reaches.
  const occupiedPlates = surveyedMassing
    ? surveyedMassing
        .filter((volume) => volume.minHeight < occupiable * spec.storyHeight)
        .map((volume) => volume.polygon)
    : [];
  const riser = occupiedPlates.length > 0 ? riserAnchorFor(occupiedPlates) : null;

  const floors: Floor[] = [];
  let elevation = 0;
  for (let index = 0; index < totalLevels; index += 1) {
    const id = index === 0 ? "l1" : `l${index + 1}`;
    const prefix = index === 0 ? "" : `${id}-`;
    const label = index === 0 ? "" : `L${index + 1} `;
    const floorSpec = surveyedMassing
      ? atMassing(spec, surveyedMassing, elevation)
      : atScale(spec, scales[index] ?? 1);
    if (!floorSpec) {
      elevation += spec.storyHeight;
      continue;
    }
    floors.push(
      compileFloor(floorSpec, {
        id,
        name: index < occupiable ? floorName(index) : spireName(index, occupiable),
        elevation,
        prefix,
        label,
        index,
        dense,
        riser,
        occupiable: index < occupiable,
      }),
    );
    elevation += spec.storyHeight;
  }
  const structuralTop = surveyedMassing
    ? Math.max(spireTop, elevation)
    : elevation;
  const eave = structuralTop + (spec.roof === "flat" ? 0.35 : 0.4);
  const ridge = spec.roof === "flat" ? eave + 0.25 : eave + Math.max(1.4, spec.width * 0.04);
  return {
    name: spec.name,
    units: "meters",
    source: {
      project: spec.project ?? spec.name,
      sheet: spec.survey ? "G1.0" : spec.typology === "retail" ? "A2.1" : "A2.2",
      title: spec.survey
        ? `${spec.name} · surveyed envelope, synthesized interior`
        : spec.reference
          ? `${spec.reference} · generated composite`
          : `${titleCase(spec.typology)} · generated composite`,
      notes: spec.notes ?? defaultNotes(spec),
    },
    datums: [
      { id: "ff-1", name: "F.F. LEVEL 1", elevation: 0 },
      ...floors.slice(1).map((floor, index) => ({
        id: `ff-${index + 2}`,
        name: `F.F. ${floor.name.toUpperCase()}`,
        elevation: floor.elevation,
      })),
      { id: "parapet", name: "T.O. ROOF / PARAPET", elevation: eave },
      { id: "roof", name: "T.O. RIDGE", elevation: ridge },
    ],
    roof: {
      type: spec.roof,
      eaveHeight: eave,
      ridgeHeight: ridge,
      overhang: spec.roof === "flat" ? 0.2 : 0.45,
    },
    floors,
  };
}

/**
 * Swaps in the surveyed setback volume that spans this elevation. Returns null
 * above the structural top, where there is nothing left to draw.
 */
function atMassing(
  spec: BuildingSpec,
  massing: MassingVolume[],
  elevation: number,
): BuildingSpec | null {
  const volume = plateAtElevation(massing, elevation);
  if (!volume) {
    return null;
  }
  return {
    ...spec,
    footprint: volume.polygon,
    zones: coreAndRingZones(volume.polygon, spec.typology, spec.stories),
  };
}

function spireName(index: number, occupiable: number): string {
  return `Mast Level ${index - occupiable + 1}`;
}

/**
 * Shrinks a surveyed plate about the footprint centroid so upper floors sit
 * back from the base. Zones ride along so the core stays centred.
 */
function atScale(spec: BuildingSpec, scale: number): BuildingSpec {
  if (!spec.footprint || scale >= 0.999) {
    return spec;
  }
  const scaleZone = (zone: ZoneSpec): ZoneSpec => {
    if (!zone.polygon) {
      return zone;
    }
    const polygon = scaleAbout(zone.polygon, spec.footprint!, scale);
    const xs = polygon.map((point) => point.x);
    const ys = polygon.map((point) => point.y);
    return {
      ...zone,
      polygon,
      x: Math.min(...xs),
      y: Math.min(...ys),
      w: Math.max(0.1, Math.max(...xs) - Math.min(...xs)),
      h: Math.max(0.1, Math.max(...ys) - Math.min(...ys)),
    };
  };
  return {
    ...spec,
    footprint: scalePolygon(spec.footprint, scale),
    zones: spec.zones.map(scaleZone),
  };
}

/** Scales `points` about the centroid of `reference`, not their own. */
function scaleAbout(
  points: { x: number; y: number }[],
  reference: { x: number; y: number }[],
  scale: number,
): { x: number; y: number }[] {
  const anchor = scalePolygon(reference, scale);
  const from = centroidOf(reference);
  const to = centroidOf(anchor);
  return points.map((point) => ({
    x: Number((to.x + (point.x - from.x) * scale).toFixed(2)),
    y: Number((to.y + (point.y - from.y) * scale).toFixed(2)),
  }));
}

function centroidOf(points: { x: number; y: number }[]): { x: number; y: number } {
  return points.reduce(
    (sum, point) => ({
      x: sum.x + point.x / points.length,
      y: sum.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
}

interface FloorMeta {
  id: string;
  name: string;
  elevation: number;
  prefix: string;
  label: string;
  index: number;
  dense: boolean;
  /** Building-wide shaft set-out so risers line up floor to floor. */
  riser: MepPlan | null;
  occupiable: boolean;
}

function compileFloor(spec: BuildingSpec, meta: FloorMeta): Floor {
  const walls = wallsFromSpec(spec, meta.prefix, meta.dense);
  const rooms = spec.zones.map((zone) => roomFromZone(zone, meta.prefix, meta.label));
  // Tall plates only glaze the base; a full curtain wall on every storey
  // triples the wall geometry without reading differently at building scale.
  const openings =
    meta.dense || meta.index === 0 ? openingsFromSpec(spec, walls, meta.prefix) : [];
  return {
    id: meta.id,
    name: meta.name,
    elevation: meta.elevation,
    occupiable: meta.occupiable,
    walls,
    openings,
    rooms,
    dimensions:
      meta.elevation === 0
        ? [
            {
              id: "dim-width",
              from: { x: 0, y: -1.1 },
              to: { x: spec.width, y: -1.1 },
              label: `${spec.width.toFixed(1)} m`,
            },
            {
              id: "dim-depth",
              from: { x: -1.1, y: 0 },
              to: { x: -1.1, y: spec.depth },
              label: `${spec.depth.toFixed(1)} m`,
            },
          ]
        : [],
    pipes: spec.includeMep ? planPipes(spec, meta.prefix, meta.dense, meta.riser) : [],
    electrical: spec.includeMep
      ? planElectrical(spec, meta.prefix, meta.dense, meta.riser)
      : [],
  };
}

function defaultNotes(spec: BuildingSpec): string {
  if (spec.survey) {
    const year = spec.survey.yearBuilt ? ` · built ${spec.survey.yearBuilt}` : "";
    return `${spec.survey.address} · BBL ${spec.survey.bbl}${year} · ${spec.width.toFixed(0)} × ${spec.depth.toFixed(0)} m footprint · ${spec.stories} floors · ${spec.survey.attribution}`;
  }
  return `Gemini spec · ${spec.width} × ${spec.depth} m · ${spec.stories} level${spec.stories === 1 ? "" : "s"} · ${spec.zones.length} zones.`;
}

function wallsFromSpec(spec: BuildingSpec, prefix: string, dense: boolean): Wall[] {
  const height = spec.storyHeight;
  const exterior = spec.exteriorColor
    ? {
        color: spec.exteriorColor,
        roughness: 0.78,
        metalness: spec.typology === "retail" ? 0.18 : 0.04,
        opacity: 1,
      }
    : defaultExterior(spec.typology);

  if (spec.footprint) {
    return wallsFromFootprint(spec, prefix, height, exterior, dense);
  }

  const walls: Wall[] = [
    wall(`${prefix}ext-south`, { x: 0, y: 0 }, { x: spec.width, y: 0 }, height, "exterior", exterior),
    wall(
      `${prefix}ext-east`,
      { x: spec.width, y: 0 },
      { x: spec.width, y: spec.depth },
      height,
      "exterior",
      exterior,
    ),
    wall(
      `${prefix}ext-north`,
      { x: 0, y: spec.depth },
      { x: spec.width, y: spec.depth },
      height,
      "exterior",
      exterior,
    ),
    wall(`${prefix}ext-west`, { x: 0, y: 0 }, { x: 0, y: spec.depth }, height, "exterior", exterior),
  ];

  const seen = new Set<string>();
  for (const zone of spec.zones) {
    const edges: [{ x: number; y: number }, { x: number; y: number }][] = [
      [{ x: zone.x, y: zone.y }, { x: zone.x + zone.w, y: zone.y }],
      [{ x: zone.x + zone.w, y: zone.y }, { x: zone.x + zone.w, y: zone.y + zone.h }],
      [{ x: zone.x, y: zone.y + zone.h }, { x: zone.x + zone.w, y: zone.y + zone.h }],
      [{ x: zone.x, y: zone.y }, { x: zone.x, y: zone.y + zone.h }],
    ];
    for (const [start, end] of edges) {
      if (isPerimeter(start, end, spec.width, spec.depth)) {
        continue;
      }
      const key = edgeKey(start, end);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const length = Math.hypot(end.x - start.x, end.y - start.y);
      if (length < 1.2) {
        continue;
      }
      walls.push(
        wall(
          `${prefix}int-${zone.id}-${seen.size}`,
          start,
          end,
          height,
          zone.kind === "circulation" ? "partition" : "interior",
        ),
      );
    }
  }
  return walls;
}

/**
 * Surveyed plates trace the measured ring for the envelope and the synthesized
 * core rings for partitions. Perimeter bays share edges with both, so emitting
 * their outlines again would double every wall.
 */
function wallsFromFootprint(
  spec: BuildingSpec,
  prefix: string,
  height: number,
  exterior: Wall["material"],
  dense: boolean,
): Wall[] {
  const ring = spec.footprint ?? [];
  const walls: Wall[] = ring.map((point, index) => {
    const next = ring[(index + 1) % ring.length];
    const [start, end] = extendEnds(point, next, EXTERIOR_THICKNESS / 2);
    return wall(
      `${prefix}ext-${index + 1}`,
      start,
      end,
      height,
      "exterior",
      exterior,
    );
  });

  for (const zone of spec.zones) {
    if (!zone.polygon || (zone.kind !== "circulation" && zone.kind !== "wet")) {
      continue;
    }
    // Above the dense threshold only the wet shaft is walled; the elevator
    // lobby still reads as a room without doubling the wall count per storey.
    if (!dense && zone.kind === "circulation") {
      continue;
    }
    zone.polygon.forEach((point, index) => {
      const next = zone.polygon![(index + 1) % zone.polygon!.length];
      if (Math.hypot(next.x - point.x, next.y - point.y) < 1) {
        return;
      }
      walls.push(
        wall(
          `${prefix}int-${zone.id}-${index + 1}`,
          point,
          next,
          height,
          zone.kind === "wet" ? "partition" : "interior",
        ),
      );
    });
  }
  return walls;
}

function openingsFromSpec(
  spec: BuildingSpec,
  walls: Wall[],
  prefix: string,
): Opening[] {
  const openings: Opening[] = [];
  const retail = spec.typology === "retail" || spec.typology === "warehouse";
  for (const item of walls) {
    const length = Math.hypot(item.end.x - item.start.x, item.end.y - item.start.y);
    if (item.type !== "exterior") {
      if (length < 2.2) {
        continue;
      }
      openings.push({
        id: `${prefix}door-${item.id}`,
        wallId: item.id,
        type: "door",
        offsetFromStart: Math.max(0.4, length / 2 - (retail ? 0.9 : 0.45)),
        width: retail ? 1.8 : 0.9,
        height: Math.min(2.4, spec.storyHeight - 0.4),
        sillHeight: 0,
      });
      continue;
    }
    const isFront = Math.abs(item.start.y) < 0.05 && Math.abs(item.end.y) < 0.05;
    if (isFront && retail) {
      const bays = Math.max(2, Math.floor(length / 10));
      for (let i = 0; i < bays; i += 1) {
        openings.push({
          id: `${prefix}storefront-${i}`,
          wallId: item.id,
          type: i === Math.floor(bays / 2) ? "door" : "window",
          offsetFromStart: (length / bays) * i + 0.8,
          width: i === Math.floor(bays / 2) ? 3.2 : 4.2,
          height: i === Math.floor(bays / 2) ? 2.6 : Math.min(3.4, spec.storyHeight - 1.2),
          sillHeight: i === Math.floor(bays / 2) ? 0 : 0.35,
        });
      }
      continue;
    }
    if (length > 8) {
      openings.push({
        id: `${prefix}win-${item.id}`,
        wallId: item.id,
        type: "window",
        offsetFromStart: length * 0.35,
        width: retail ? 2.4 : 1.4,
        height: retail ? 1.8 : 1.3,
        sillHeight: retail ? 1.4 : 0.95,
      });
    }
  }
  return openings;
}

function roomFromZone(zone: ZoneSpec, prefix: string, label: string): Room {
  const boundary = zone.polygon ?? [
    { x: zone.x, y: zone.y },
    { x: zone.x + zone.w, y: zone.y },
    { x: zone.x + zone.w, y: zone.y + zone.h },
    { x: zone.x, y: zone.y + zone.h },
  ];
  const centroid = boundary.reduce(
    (sum, point) => ({ x: sum.x + point.x / boundary.length, y: sum.y + point.y / boundary.length }),
    { x: 0, y: 0 },
  );
  return {
    id: `${prefix}${zone.id}`,
    name: `${label}${zone.name}`,
    boundary,
    floorHeight: 0,
    labelPosition: zone.polygon
      ? { x: Number(centroid.x.toFixed(2)), y: Number(centroid.y.toFixed(2)) }
      : { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 },
    areaSqM: Number(
      (zone.polygon ? polygonArea(zone.polygon) : zone.w * zone.h).toFixed(1),
    ),
    material: roomTone(zone.kind),
  };
}

function polygonArea(points: Room["boundary"]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum / 2);
}

const EXTERIOR_THICKNESS = 0.3;

/**
 * Wall boxes stop dead at each corner, leaving a notch on the outside face.
 * One notch is invisible; a hundred stacked storeys read as a serrated edge,
 * so ring walls are run long by half a thickness to overlap and close it.
 */
function extendEnds(
  start: Wall["start"],
  end: Wall["end"],
  amount: number,
): [Wall["start"], Wall["end"]] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.001) {
    return [start, end];
  }
  const ux = (dx / length) * amount;
  const uy = (dy / length) * amount;
  return [
    { x: Number((start.x - ux).toFixed(3)), y: Number((start.y - uy).toFixed(3)) },
    { x: Number((end.x + ux).toFixed(3)), y: Number((end.y + uy).toFixed(3)) },
  ];
}

function wall(
  id: string,
  start: Wall["start"],
  end: Wall["end"],
  height: number,
  type: Wall["type"],
  material?: Wall["material"],
): Wall {
  return {
    id,
    start,
    end,
    height,
    thickness:
      type === "exterior" ? EXTERIOR_THICKNESS : type === "partition" ? 0.1 : 0.15,
    type,
    material,
  };
}

function defaultExterior(typology: BuildingSpec["typology"]) {
  if (typology === "retail") {
    return { color: "#c8ccd1", roughness: 0.7, metalness: 0.22, opacity: 1 };
  }
  if (typology === "warehouse") {
    return { color: "#9aa3ad", roughness: 0.62, metalness: 0.28, opacity: 1 };
  }
  return { color: "#d7cec0", roughness: 0.9, metalness: 0.03, opacity: 1 };
}

function roomTone(kind: ZoneKind) {
  const colors: Record<ZoneKind, string> = {
    entry: "#d8c9a5",
    sales: "#c9c2b2",
    service: "#c4b7a2",
    back: "#b7b1a6",
    wet: "#b9c4c8",
    circulation: "#cfc8bc",
    living: "#cbb48a",
    work: "#c2c6cb",
  };
  return { color: colors[kind], roughness: 0.9, metalness: 0, opacity: 1 };
}

function isPerimeter(
  start: { x: number; y: number },
  end: { x: number; y: number },
  width: number,
  depth: number,
): boolean {
  const onX = (value: number) => Math.abs(value) < 0.08 || Math.abs(value - width) < 0.08;
  const onY = (value: number) => Math.abs(value) < 0.08 || Math.abs(value - depth) < 0.08;
  return (onX(start.x) && onX(end.x)) || (onY(start.y) && onY(end.y));
}

function edgeKey(
  start: { x: number; y: number },
  end: { x: number; y: number },
): string {
  const a = `${start.x.toFixed(2)},${start.y.toFixed(2)}`;
  const b = `${end.x.toFixed(2)},${end.y.toFixed(2)}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function floorName(index: number): string {
  return ["First Floor", "Second Floor", "Third Floor", "Fourth Floor"][index] ??
    `Level ${index + 1}`;
}

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
