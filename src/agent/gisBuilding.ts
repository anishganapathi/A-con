import type { Point2D } from "../types/floorPlan";
import type { BuildingSpec, BuildingTypology, MassingVolume } from "./buildingSpec";

export interface GisBuilding {
  name: string;
  address: string;
  bbl: string;
  bin: string;
  footprint: Point2D[];
  widthM: number;
  depthM: number;
  heightRoofM: number;
  groundElevM: number;
  numFloors: number;
  storyHeightM: number;
  yearBuilt: number | null;
  bldgClass: string | null;
  landUse: string | null;
  areas: {
    building: number;
    office: number;
    retail: number;
    residential: number;
    garage: number;
    storage: number;
    factory: number;
  };
  unitsResidential: number;
  unitsTotal: number;
  latitude: number;
  longitude: number;
  heightEstimated: boolean;
  attribution: string;
  massing: MassingVolume[];
  tipHeightM: number;
}

const LANDMARK_WORDS = [
  "empire state",
  "chrysler building",
  "flatiron",
  "woolworth building",
  "rockefeller center",
  "30 rock",
  "world trade center",
  "grand central",
  "madison square garden",
  "barclays center",
  "met life building",
  "seagram building",
  "lipstick building",
  "hearst tower",
  "new york public library",
];

/** Mirrors the server-side detector so the chat can route without a round trip. */
export function looksLikeNycLookup(text: string): boolean {
  const lower = text.toLowerCase();
  if (LANDMARK_WORDS.some((name) => lower.includes(name))) {
    return true;
  }
  if (/\bbbl[: ]?\s*\d{10}\b/.test(lower) || /\b\d{10}\b/.test(lower)) {
    return true;
  }
  const hasNycHint =
    /\b(nyc|new york|manhattan|brooklyn|queens|bronx|staten island)\b/.test(lower);
  const hasStreetAddress =
    /\b\d{1,4}\s+(?:[nsew]\.?\s+)?\w+(?:\s+\w+)?\s+(?:st|street|ave|avenue|blvd|boulevard|rd|road|pl|place|plaza|broadway|pkwy|parkway|lane|ln|dr|drive)\b/.test(
      lower,
    );
  return hasNycHint && hasStreetAddress;
}

export async function fetchNycBuilding(query: string): Promise<GisBuilding> {
  const response = await fetch("/api/gis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    const failure = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(failure?.error ?? `NYC GIS lookup failed (${response.status})`);
  }
  return (await response.json()) as GisBuilding;
}

export function specFromGis(building: GisBuilding): Partial<BuildingSpec> {
  const typology = typologyFor(building);
  return {
    name: building.name,
    reference: building.address,
    typology,
    width: building.widthM,
    depth: building.depthM,
    stories: building.numFloors,
    storyHeight: building.storyHeightM,
    roof: "flat",
    exteriorColor: exteriorFor(typology, building.yearBuilt),
    includeMep: true,
    project: building.name,
    footprint: building.footprint,
    grossFloorAreaM2: building.areas.building * 0.092903,
    massing: building.massing,
    tipHeight: building.tipHeightM,
    survey: {
      provider: "NYC Open Data",
      address: building.address,
      bbl: building.bbl,
      bin: building.bin,
      yearBuilt: building.yearBuilt,
      bldgClass: building.bldgClass,
      latitude: building.latitude,
      longitude: building.longitude,
      heightEstimated: building.heightEstimated,
      attribution: building.attribution,
    },
  };
}

export function describeGis(building: GisBuilding): string {
  const parts = [
    `${building.name} — ${building.address}`,
    `${building.widthM.toFixed(0)} × ${building.depthM.toFixed(0)} m footprint (${building.footprint.length} corners)`,
    `${building.numFloors} floors, ${building.heightRoofM.toFixed(0)} m to roof`,
  ];
  if (building.yearBuilt) {
    parts.push(`built ${building.yearBuilt}`);
  }
  if (building.areas.building > 0) {
    parts.push(`${Math.round(building.areas.building).toLocaleString()} sq ft`);
  }
  const measured = building.heightEstimated
    ? "Height is estimated from PLUTO floor count (no LiDAR value published)."
    : "Footprint and roof height are measured values from NYC Open Data.";
  const massing =
    building.massing.length > 0
      ? ` Setbacks come from ${building.massing.length} surveyed massing volumes in OpenStreetMap, topping out at ${building.tipHeightM.toFixed(0)} m including the spire.`
      : " No 3D massing is published for this building, so the setbacks are inferred from the recorded floor area.";
  return `${parts.join(" · ")}. ${measured}${massing} Interior partitions, pipework, and wiring are not public record anywhere — those are synthesized as a plausible core-and-perimeter layout.`;
}

function typologyFor(building: GisBuilding): BuildingTypology {
  const code = (building.bldgClass ?? "").trim().charAt(0).toUpperCase();
  const { office, retail, residential, factory, storage } = building.areas;

  if (code === "O") {
    return "office";
  }
  if (code === "K") {
    return "retail";
  }
  if (code === "E" || code === "F") {
    return "warehouse";
  }
  if (["I", "J", "M", "P", "Q", "W", "Y"].includes(code)) {
    return "civic";
  }
  if (["A", "B", "C", "D", "H", "L", "N", "R", "S"].includes(code)) {
    return residential === 0 && office > 0 ? "office" : "residential";
  }

  const biggest = Math.max(office, retail, residential, factory + storage);
  if (biggest === 0) {
    return "office";
  }
  if (biggest === office) {
    return "office";
  }
  if (biggest === retail) {
    return "retail";
  }
  if (biggest === factory + storage) {
    return "warehouse";
  }
  return "residential";
}

function exteriorFor(typology: BuildingTypology, yearBuilt: number | null): string {
  if (yearBuilt && yearBuilt < 1945) {
    return "#b9ab96"; // pre-war masonry / limestone
  }
  if (yearBuilt && yearBuilt > 1995) {
    return "#9fb2bd"; // modern curtain wall
  }
  if (typology === "warehouse") {
    return "#9aa3ad";
  }
  if (typology === "retail") {
    return "#c8ccd1";
  }
  return "#c2beb4";
}
