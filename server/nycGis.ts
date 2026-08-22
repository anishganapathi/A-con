/**
 * NYC Open Data lookup: address or BBL -> real building footprint + program.
 *
 * Sources (all public, no key required):
 *   GeoSearch  https://geosearch.planninglabs.nyc/v2/search   address -> BBL / BIN
 *   Footprints https://data.cityofnewyork.us/resource/5zhs-2jue.json
 *   PLUTO      https://data.cityofnewyork.us/resource/64uk-42ks.json
 *
 * Footprints and PLUTO carry the real envelope only. Interior partitions and
 * MEP are never published, so the compiler synthesizes those downstream.
 */

const GEOSEARCH = "https://geosearch.planninglabs.nyc/v2/search";
const FOOTPRINTS = "https://data.cityofnewyork.us/resource/5zhs-2jue.json";
const PLUTO = "https://data.cityofnewyork.us/resource/64uk-42ks.json";

const FEET_TO_M = 0.3048;
const M_PER_DEG_LAT = 111320;

/** Landmarks people ask for by name rather than by street address. */
const LANDMARKS: Record<string, string> = {
  "empire state building": "350 5 Avenue, Manhattan",
  "chrysler building": "405 Lexington Avenue, Manhattan",
  "flatiron building": "175 5 Avenue, Manhattan",
  "woolworth building": "233 Broadway, Manhattan",
  "rockefeller center": "45 Rockefeller Plaza, Manhattan",
  "30 rock": "30 Rockefeller Plaza, Manhattan",
  "one world trade center": "285 Fulton Street, Manhattan",
  "world trade center": "285 Fulton Street, Manhattan",
  "grand central": "89 E 42 Street, Manhattan",
  "madison square garden": "4 Pennsylvania Plaza, Manhattan",
  "barclays center": "620 Atlantic Avenue, Brooklyn",
  "met life building": "200 Park Avenue, Manhattan",
  "seagram building": "375 Park Avenue, Manhattan",
  "lipstick building": "885 3 Avenue, Manhattan",
  "hearst tower": "300 W 57 Street, Manhattan",
  "new york public library": "476 5 Avenue, Manhattan",
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export interface GisPoint {
  x: number;
  y: number;
}

/**
 * One extruded volume of a building's massing. Landmarks are mapped in
 * OpenStreetMap with the Simple 3D Buildings schema, which records each
 * setback as a `building:part` with its own footprint and height band.
 */
export interface MassingVolume {
  id: string;
  polygon: GisPoint[];
  minHeight: number;
  maxHeight: number;
  roofShape: string | null;
  roofHeight: number;
}

export interface GisBuilding {
  name: string;
  address: string;
  bbl: string;
  bin: string;
  /** Footprint in meters, shifted so the bounding box starts at the origin. */
  footprint: GisPoint[];
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
  /** True when height came from PLUTO floors rather than measured LiDAR. */
  heightEstimated: boolean;
  attribution: string;
  /** Surveyed setback volumes when the building is modelled in OSM. */
  massing: MassingVolume[];
  /** Structural top including any spire or mast, in meters. */
  tipHeightM: number;
}

export function resolveLandmark(query: string): string {
  const key = query.trim().toLowerCase().replace(/\s+/g, " ");
  for (const [name, address] of Object.entries(LANDMARKS)) {
    if (key === name || key.includes(name)) {
      return address;
    }
  }
  return query;
}

/** Detects a prompt that should be answered from NYC GIS rather than the LLM. */
export function looksLikeNycLookup(text: string): boolean {
  const lower = text.toLowerCase();
  if (Object.keys(LANDMARKS).some((name) => lower.includes(name))) {
    return true;
  }
  if (/\bbbl[: ]?\s*\d{10}\b/.test(lower) || /\bbin[: ]?\s*\d{7}\b/.test(lower)) {
    return true;
  }
  const hasNycHint =
    /\b(nyc|new york|manhattan|brooklyn|queens|bronx|staten island)\b/.test(lower);
  const hasStreetAddress =
    /\b\d{1,4}\s+(?:[NnSsEeWw]\.?\s+)?\w+(?:\s+\w+)?\s+(?:st|street|ave|avenue|blvd|boulevard|rd|road|pl|place|plaza|broadway|pkwy|parkway|lane|ln|dr|drive)\b/.test(
      lower,
    );
  return hasNycHint && hasStreetAddress;
}

export async function lookupNycBuilding(query: string): Promise<GisBuilding> {
  const bblMatch = query.match(/\b(\d{10})\b/);
  const bbl = bblMatch?.[1] ?? (await geocodeToBbl(resolveLandmark(query)));
  const footprint = await fetchFootprint(bbl);
  const lot = await fetchPluto(bbl);
  const { building, origin } = assemble(query, bbl, footprint, lot);

  // Setbacks are invisible in a 2D footprint. When OSM has modelled the
  // building in 3D, that is a real survey and beats any inferred taper.
  try {
    const massing = await fetchOsmMassing(origin, building);
    if (massing.length > 0) {
      building.massing = massing;
      building.tipHeightM = Math.max(
        building.heightRoofM,
        ...massing.map((volume) => volume.maxHeight),
      );
      building.attribution +=
        " Setback massing from OpenStreetMap (ODbL) Simple 3D Buildings.";
    }
  } catch {
    // Overpass is best-effort; the inferred taper still applies.
  }
  return building;
}

interface Origin {
  lat: number;
  lon: number;
  metersPerDegLon: number;
  shiftX: number;
  shiftY: number;
}

const massingCache = new Map<string, MassingVolume[]>();

async function fetchOsmMassing(
  origin: Origin,
  building: GisBuilding,
): Promise<MassingVolume[]> {
  const cached = massingCache.get(building.bbl);
  if (cached) {
    return cached;
  }

  const radius = Math.max(60, Math.hypot(building.widthM, building.depthM) * 0.75);
  const query = `[out:json][timeout:25];way["building:part"](around:${Math.round(radius)},${origin.lat.toFixed(6)},${origin.lon.toFixed(6)});out geom;`;

  let payload: { elements?: OsmWay[] } | null = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      // Overpass needs the query form-encoded as `data`, and rejects clients
      // that do not identify themselves with a User-Agent.
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "E-kon/1.0 (construction viewer; NYC massing lookup)",
          Accept: "application/json",
        },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) {
        continue;
      }
      payload = (await response.json()) as { elements?: OsmWay[] };
      break;
    } catch {
      // try the next mirror
    }
  }
  if (!payload?.elements?.length) {
    return [];
  }

  const volumes: MassingVolume[] = [];
  for (const way of payload.elements) {
    const geometry = way.geometry ?? [];
    if (geometry.length < 4) {
      continue;
    }
    const maxHeight = parseLength(way.tags?.height);
    const minHeight = parseLength(way.tags?.min_height) ?? 0;
    if (maxHeight === null || maxHeight <= minHeight) {
      continue;
    }
    let polygon = geometry.map((node) => ({
      x: (node.lon - origin.lon) * origin.metersPerDegLon - origin.shiftX,
      y: (node.lat - origin.lat) * M_PER_DEG_LAT - origin.shiftY,
    }));
    polygon = dedupe(polygon);
    if (polygon.length < 4) {
      continue;
    }
    if (signedArea(polygon) < 0) {
      polygon.reverse();
    }
    polygon = limitVertices(simplify(polygon, 0.6), 16).map((point) => ({
      x: round(point.x),
      y: round(point.y),
    }));

    // Neighbouring towers can fall inside the search radius, so keep only
    // parts that actually sit over this tax lot's footprint.
    const centre = centroid(polygon);
    if (!pointInPolygon(centre, building.footprint)) {
      continue;
    }
    volumes.push({
      id: `osm-${way.id}`,
      polygon,
      minHeight: round(minHeight),
      maxHeight: round(maxHeight),
      roofShape: way.tags?.["roof:shape"] ?? null,
      roofHeight: parseLength(way.tags?.["roof:height"]) ?? 0,
    });
  }

  volumes.sort((a, b) => a.minHeight - b.minHeight || a.maxHeight - b.maxHeight);
  massingCache.set(building.bbl, volumes);
  return volumes;
}

interface OsmWay {
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

/** OSM heights are metres by default but may be quoted in feet. */
function parseLength(raw: string | undefined): number | null {
  if (!raw) {
    return null;
  }
  const feet = raw.match(/^([\d.]+)\s*(?:'|ft|feet)$/i);
  if (feet) {
    return Number(feet[1]) * FEET_TO_M;
  }
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

function centroid(points: GisPoint[]): GisPoint {
  return points.reduce(
    (sum, point) => ({
      x: sum.x + point.x / points.length,
      y: sum.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
}

function pointInPolygon(point: GisPoint, polygon: GisPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

interface FootprintRow {
  bin?: string;
  the_geom?: { type: string; coordinates: number[][][][] | number[][][] };
  height_roof?: string;
  ground_elevation?: string;
  construction_year?: string;
  shape_area?: string;
}

interface PlutoRow {
  address?: string;
  numfloors?: string;
  bldgarea?: string;
  officearea?: string;
  retailarea?: string;
  resarea?: string;
  garagearea?: string;
  strgearea?: string;
  factryarea?: string;
  bldgclass?: string;
  landuse?: string;
  yearbuilt?: string;
  unitsres?: string;
  unitstotal?: string;
  latitude?: string;
  longitude?: string;
  ownername?: string;
}

async function geocodeToBbl(address: string): Promise<string> {
  const url = `${GEOSEARCH}?text=${encodeURIComponent(address)}&size=5`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NYC GeoSearch returned ${response.status}`);
  }
  const data = (await response.json()) as {
    features?: {
      properties?: {
        label?: string;
        addendum?: { pad?: { bbl?: string; bin?: string } };
      };
    }[];
  };
  const features = data.features ?? [];
  const hit = features.find((feature) => feature.properties?.addendum?.pad?.bbl);
  const found = hit?.properties?.addendum?.pad?.bbl;
  if (!found) {
    throw new Error(
      `Could not find "${address}" in the NYC address register. Try a full street address with the borough.`,
    );
  }
  return found;
}

async function fetchFootprint(bbl: string): Promise<FootprintRow> {
  const url = `${FOOTPRINTS}?${new URLSearchParams({
    $where: `base_bbl='${bbl}' OR mappluto_bbl='${bbl}'`,
    $limit: "40",
  })}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`NYC Building Footprints returned ${response.status}`);
  }
  const rows = (await response.json()) as FootprintRow[];
  if (rows.length === 0) {
    throw new Error(`No building footprint is published for BBL ${bbl}.`);
  }
  // A tax lot can hold several structures; model the largest one.
  return rows.reduce((biggest, row) =>
    Number(row.shape_area ?? 0) > Number(biggest.shape_area ?? 0) ? row : biggest,
  );
}

async function fetchPluto(bbl: string): Promise<PlutoRow | null> {
  const url = `${PLUTO}?${new URLSearchParams({
    $where: `bbl=${Number(bbl)}`,
    $limit: "1",
  })}`;
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  const rows = (await response.json()) as PlutoRow[];
  return rows[0] ?? null;
}

function assemble(
  query: string,
  bbl: string,
  row: FootprintRow,
  lot: PlutoRow | null,
): { building: GisBuilding; origin: Origin } {
  const ring = outerRing(row.the_geom);
  if (ring.length < 4) {
    throw new Error(`Footprint geometry for BBL ${bbl} is unusable.`);
  }

  const lat0 = average(ring.map((point) => point[1]));
  const lon0 = average(ring.map((point) => point[0]));
  const metersPerDegLon = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);

  // Equirectangular projection about the footprint centroid. Over a single
  // city block the distortion is far below the accuracy of the source data.
  let points: GisPoint[] = ring.map((point) => ({
    x: (point[0] - lon0) * metersPerDegLon,
    y: (point[1] - lat0) * M_PER_DEG_LAT,
  }));

  points = dedupe(points);
  if (signedArea(points) < 0) {
    points.reverse();
  }
  points = simplify(points, 0.9);
  points = limitVertices(points, 14);

  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  points = points.map((point) => ({
    x: round(point.x - minX),
    y: round(point.y - minY),
  }));

  const widthM = round(Math.max(...points.map((point) => point.x)));
  const depthM = round(Math.max(...points.map((point) => point.y)));

  const measuredHeight = Number(row.height_roof ?? 0) * FEET_TO_M;
  const numFloors = Math.max(1, Math.round(Number(lot?.numfloors ?? 0)) || 0);
  const heightEstimated = !(measuredHeight > 2);
  const floors = numFloors || Math.max(1, Math.round(measuredHeight / 3.5)) || 1;
  const heightRoofM = heightEstimated ? floors * 3.5 : measuredHeight;

  const building: GisBuilding = {
    name: buildingName(query, lot, bbl),
    address: lot?.address ?? resolveLandmark(query),
    bbl,
    bin: row.bin ?? "",
    footprint: points,
    widthM,
    depthM,
    heightRoofM: round(heightRoofM),
    groundElevM: round(Number(row.ground_elevation ?? 0) * FEET_TO_M),
    numFloors: floors,
    storyHeightM: round(heightRoofM / floors),
    yearBuilt: Number(lot?.yearbuilt ?? row.construction_year ?? 0) || null,
    bldgClass: lot?.bldgclass ?? null,
    landUse: lot?.landuse ?? null,
    areas: {
      building: Number(lot?.bldgarea ?? 0),
      office: Number(lot?.officearea ?? 0),
      retail: Number(lot?.retailarea ?? 0),
      residential: Number(lot?.resarea ?? 0),
      garage: Number(lot?.garagearea ?? 0),
      storage: Number(lot?.strgearea ?? 0),
      factory: Number(lot?.factryarea ?? 0),
    },
    unitsResidential: Number(lot?.unitsres ?? 0),
    unitsTotal: Number(lot?.unitstotal ?? 0),
    latitude: Number(lot?.latitude ?? lat0),
    longitude: Number(lot?.longitude ?? lon0),
    heightEstimated,
    attribution:
      "NYC Open Data — Building Footprints (OTI) + PLUTO (DCP). Envelope is measured; interior layout and MEP are synthesized.",
    massing: [],
    tipHeightM: round(heightRoofM),
  };

  return {
    building,
    origin: {
      lat: lat0,
      lon: lon0,
      metersPerDegLon,
      shiftX: minX,
      shiftY: minY,
    },
  };
}

function buildingName(query: string, lot: PlutoRow | null, bbl: string): string {
  const landmark = Object.keys(LANDMARKS).find((name) =>
    query.toLowerCase().includes(name),
  );
  if (landmark) {
    return landmark.replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return lot?.address ?? `BBL ${bbl}`;
}

function outerRing(
  geom: FootprintRow["the_geom"],
): number[][] {
  if (!geom) {
    return [];
  }
  if (geom.type === "MultiPolygon") {
    const polygons = geom.coordinates as number[][][][];
    const rings = polygons.map((polygon) => polygon[0] ?? []);
    return rings.reduce(
      (biggest, ring) => (Math.abs(signedAreaRaw(ring)) > Math.abs(signedAreaRaw(biggest)) ? ring : biggest),
      rings[0] ?? [],
    );
  }
  const polygon = geom.coordinates as number[][][];
  return polygon[0] ?? [];
}

function signedAreaRaw(ring: number[][]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

function signedArea(points: GisPoint[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

function dedupe(points: GisPoint[]): GisPoint[] {
  const out: GisPoint[] = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 0.05) {
      out.push(point);
    }
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && first && last && Math.hypot(first.x - last.x, first.y - last.y) < 0.05) {
    out.pop();
  }
  return out;
}

/** Ramer-Douglas-Peucker on a closed ring. */
function simplify(points: GisPoint[], tolerance: number): GisPoint[] {
  if (points.length <= 4) {
    return points;
  }
  const keep = rdp(points, tolerance);
  return keep.length >= 4 ? keep : points;
}

function rdp(points: GisPoint[], tolerance: number): GisPoint[] {
  if (points.length < 3) {
    return points;
  }
  let maxDistance = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicular(points[i], first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance <= tolerance) {
    return [first, last];
  }
  const left = rdp(points.slice(0, index + 1), tolerance);
  const right = rdp(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

function perpendicular(point: GisPoint, a: GisPoint, b: GisPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y);
  }
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/** Drops the shortest edges until the ring fits the geometry budget. */
function limitVertices(points: GisPoint[], max: number): GisPoint[] {
  let out = [...points];
  while (out.length > max) {
    let shortest = Infinity;
    let index = 0;
    for (let i = 0; i < out.length; i += 1) {
      const a = out[i];
      const b = out[(i + 1) % out.length];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < shortest) {
        shortest = length;
        index = i;
      }
    }
    out.splice(index, 1);
  }
  return out;
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
