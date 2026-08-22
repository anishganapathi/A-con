import type {
  ElectricalRun,
  Floor,
  FloorPlan,
  Opening,
  PipeRun,
  Room,
  Wall,
} from "../types/floorPlan";
import type { BuildingSpec, ZoneKind, ZoneSpec } from "./buildingSpec";
import { normalizeSpec } from "./buildingSpec";

export function compileSpec(raw: Partial<BuildingSpec>): FloorPlan {
  const spec = normalizeSpec(raw);
  const floors: Floor[] = [];
  let elevation = 0;
  for (let index = 0; index < spec.stories; index += 1) {
    const id = index === 0 ? "l1" : `l${index + 1}`;
    const prefix = index === 0 ? "" : `${id}-`;
    const label = index === 0 ? "" : `L${index + 1} `;
    floors.push(
      compileFloor(spec, {
        id,
        name: floorName(index),
        elevation,
        prefix,
        label,
      }),
    );
    elevation += spec.storyHeight;
  }
  const eave = elevation + (spec.roof === "flat" ? 0.35 : 0.4);
  const ridge = spec.roof === "flat" ? eave + 0.25 : eave + Math.max(1.4, spec.width * 0.04);
  return {
    name: spec.name,
    units: "meters",
    source: {
      project: spec.project ?? spec.name,
      sheet: spec.typology === "retail" ? "A2.1" : "A2.2",
      title: spec.reference
        ? `${spec.reference} · generated composite`
        : `${titleCase(spec.typology)} · generated composite`,
      notes:
        spec.notes ??
        `Gemini spec · ${spec.width} × ${spec.depth} m · ${spec.stories} level${spec.stories === 1 ? "" : "s"} · ${spec.zones.length} zones.`,
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

function compileFloor(
  spec: BuildingSpec,
  meta: { id: string; name: string; elevation: number; prefix: string; label: string },
): Floor {
  const walls = wallsFromSpec(spec, meta.prefix);
  const rooms = spec.zones.map((zone) => roomFromZone(zone, meta.prefix, meta.label));
  const openings = openingsFromSpec(spec, walls, meta.prefix);
  return {
    id: meta.id,
    name: meta.name,
    elevation: meta.elevation,
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
    pipes: spec.includeMep ? pipesFromSpec(spec, meta.prefix) : [],
    electrical: spec.includeMep ? electricalFromSpec(spec, meta.prefix) : [],
  };
}

function wallsFromSpec(spec: BuildingSpec, prefix: string): Wall[] {
  const height = spec.storyHeight;
  const exterior = spec.exteriorColor
    ? {
        color: spec.exteriorColor,
        roughness: 0.78,
        metalness: spec.typology === "retail" ? 0.18 : 0.04,
        opacity: 1,
      }
    : defaultExterior(spec.typology);
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
  const boundary = [
    { x: zone.x, y: zone.y },
    { x: zone.x + zone.w, y: zone.y },
    { x: zone.x + zone.w, y: zone.y + zone.h },
    { x: zone.x, y: zone.y + zone.h },
  ];
  return {
    id: `${prefix}${zone.id}`,
    name: `${label}${zone.name}`,
    boundary,
    floorHeight: 0,
    labelPosition: { x: zone.x + zone.w / 2, y: zone.y + zone.h / 2 },
    areaSqM: Number((zone.w * zone.h).toFixed(1)),
    material: roomTone(zone.kind),
  };
}

function pipesFromSpec(spec: BuildingSpec, prefix: string): PipeRun[] {
  const wet = spec.zones.filter((zone) => zone.kind === "wet" || /restroom|bath|kitchen|grocery/i.test(zone.name));
  const back = spec.zones.find((zone) => zone.kind === "back") ?? spec.zones[spec.zones.length - 1];
  const stackX = (back?.x ?? spec.width - 2) + (back?.w ?? 2) * 0.7;
  const stackY = (back?.y ?? spec.depth - 2) + (back?.h ?? 2) * 0.35;
  const hang = Math.min(spec.storyHeight - 0.6, spec.storyHeight * 0.82);
  const pipes: PipeRun[] = [
    {
      id: `${prefix}pipe-stack-waste`,
      name: "Waste stack",
      system: "waste",
      diameter: spec.typology === "retail" ? 0.15 : 0.1,
      points: [
        { x: stackX, y: stackY, height: 0.15 },
        { x: stackX, y: stackY, height: spec.storyHeight },
      ],
    },
    {
      id: `${prefix}pipe-stack-supply`,
      name: "Supply riser",
      system: "supply",
      diameter: 0.05,
      points: [
        { x: stackX + 0.25, y: stackY, height: 0.2 },
        { x: stackX + 0.25, y: stackY, height: spec.storyHeight },
      ],
    },
  ];
  for (const zone of wet) {
    const cx = zone.x + zone.w * 0.4;
    const cy = zone.y + zone.h * 0.45;
    pipes.push({
      id: `${prefix}pipe-supply-${zone.id}`,
      name: `Supply — ${zone.name}`,
      system: "supply",
      diameter: 0.032,
      points: [
        { x: stackX, y: stackY, height: hang },
        { x: cx, y: stackY, height: hang },
        { x: cx, y: cy, height: 0.9 },
      ],
    });
    pipes.push({
      id: `${prefix}pipe-waste-${zone.id}`,
      name: `Waste — ${zone.name}`,
      system: "waste",
      diameter: 0.075,
      points: [
        { x: cx, y: cy, height: 0.22 },
        { x: stackX, y: stackY, height: 0.22 },
      ],
    });
  }
  return pipes;
}

function electricalFromSpec(spec: BuildingSpec, prefix: string): ElectricalRun[] {
  const back = spec.zones.find((zone) => zone.kind === "back") ?? spec.zones[0];
  const riserX = (back?.x ?? 2) + 1.2;
  const riserY = (back?.y ?? 2) + 1.2;
  const light = Math.min(spec.storyHeight - 0.7, spec.storyHeight * 0.78);
  const runs: ElectricalRun[] = [
    {
      id: `${prefix}elec-riser`,
      name: "Electrical riser",
      circuit: "power",
      diameter: 0.05,
      points: [
        { x: riserX, y: riserY, height: 0.2 },
        { x: riserX, y: riserY, height: spec.storyHeight },
      ],
    },
  ];
  for (const zone of spec.zones) {
    runs.push({
      id: `${prefix}elec-light-${zone.id}`,
      name: `Lighting — ${zone.name}`,
      circuit: "lighting",
      diameter: 0.02,
      points: [
        { x: riserX, y: riserY, height: light },
        { x: zone.x + zone.w * 0.5, y: zone.y + zone.h * 0.35, height: light },
        { x: zone.x + zone.w * 0.5, y: zone.y + zone.h * 0.7, height: light },
      ],
    });
  }
  const checkout = spec.zones.find((zone) => /check|entry|vestibule/i.test(zone.name));
  if (checkout) {
    runs.push({
      id: `${prefix}elec-power-front`,
      name: "Power — front of house",
      circuit: "power",
      diameter: 0.025,
      points: [
        { x: riserX, y: riserY, height: 0.4 },
        { x: checkout.x + checkout.w * 0.5, y: checkout.y + 1.2, height: 0.4 },
      ],
    });
  }
  return runs;
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
    thickness: type === "exterior" ? 0.3 : type === "partition" ? 0.1 : 0.15,
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
    `Floor ${index + 1}`;
}

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
