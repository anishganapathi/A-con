import { describe, expect, test } from "vitest";
import type { GisPoint, Origin, OsmWay } from "./nycGis";
import { overpassQuery, readOsmMassing } from "./nycGis";

const M_PER_DEG_LAT = 111320;

const origin: Origin = {
  lat: 40.748,
  lon: -73.985,
  metersPerDegLon: 100000,
  shiftX: 0,
  shiftY: 0,
};

/** Lot footprint, 40 x 30 m with its corner on the origin. */
const footprint: GisPoint[] = [
  { x: 0, y: 0 },
  { x: 40, y: 0 },
  { x: 40, y: 30 },
  { x: 0, y: 30 },
];

const ROOF = 120;

/** Expresses a metre offset from the origin as the lat/lon Overpass returns. */
function at(x: number, y: number): { lat: number; lon: number } {
  return {
    lat: origin.lat + y / M_PER_DEG_LAT,
    lon: origin.lon + x / origin.metersPerDegLon,
  };
}

function ring(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): { lat: number; lon: number }[] {
  return [
    at(minX, minY),
    at(maxX, minY),
    at(maxX, maxY),
    at(minX, maxY),
    at(minX, minY),
  ];
}

function part(id: number, tags: Record<string, string>, geometry = ring(4, 4, 36, 26)): OsmWay {
  return { id, tags, geometry };
}

describe("overpassQuery", () => {
  test("asks for masts and antennas as well as building parts", () => {
    const query = overpassQuery(origin.lat, origin.lon, 110);

    expect(query).toContain("building:part");
    expect(query).toMatch(/man_made/);
    expect(query).toMatch(/mast|antenna/);
    expect(query).toContain("110");
  });
});

describe("readOsmMassing", () => {
  test("reads setback volumes from building parts", () => {
    const { volumes } = readOsmMassing(
      [
        part(1, { "building:part": "yes", height: "100" }, ring(0, 0, 40, 30)),
        part(2, { "building:part": "yes", height: "160", min_height: "100" }),
      ],
      origin,
      footprint,
      ROOF,
    );

    expect(volumes).toHaveLength(2);
    expect(volumes[0].minHeight).toBe(0);
    expect(volumes[0].maxHeight).toBe(100);
    expect(volumes[1].minHeight).toBe(100);
    expect(volumes[1].maxHeight).toBe(160);
  });

  test("takes the tip from the tallest surveyed part", () => {
    const { tipHeight } = readOsmMassing(
      [
        part(1, { "building:part": "yes", height: "100" }, ring(0, 0, 40, 30)),
        part(2, { "building:part": "yes", height: "160", min_height: "100" }),
      ],
      origin,
      footprint,
      ROOF,
    );

    expect(tipHeight).toBe(160);
  });

  test("takes the tip from a mast that is not a building part", () => {
    const { tipHeight } = readOsmMassing(
      [
        part(1, { "building:part": "yes", height: "100" }, ring(0, 0, 40, 30)),
        part(2, { man_made: "mast", height: "180" }, ring(19, 14, 21, 16)),
      ],
      origin,
      footprint,
      ROOF,
    );

    expect(tipHeight).toBe(180);
  });

  test("keeps a mast out of the floor plates", () => {
    const { volumes } = readOsmMassing(
      [
        part(1, { "building:part": "yes", height: "100" }, ring(0, 0, 40, 30)),
        part(2, { man_made: "mast", height: "180" }, ring(19, 14, 21, 16)),
      ],
      origin,
      footprint,
      ROOF,
    );

    expect(volumes.map((volume) => volume.id)).toEqual(["osm-1"]);
  });

  test("takes the tip from the building outline when it has no parts", () => {
    const { volumes, tipHeight } = readOsmMassing(
      [part(9, { building: "yes", height: "443.2" }, ring(0, 0, 40, 30))],
      origin,
      footprint,
      ROOF,
    );

    expect(volumes).toHaveLength(0);
    expect(tipHeight).toBeCloseTo(443.2, 1);
  });

  test("never reports a tip below the measured roof", () => {
    const { tipHeight } = readOsmMassing([], origin, footprint, ROOF);

    expect(tipHeight).toBe(ROOF);
  });

  test("ignores structures standing off the lot", () => {
    const { volumes, tipHeight } = readOsmMassing(
      [part(3, { man_made: "mast", height: "400" }, ring(200, 200, 210, 210))],
      origin,
      footprint,
      ROOF,
    );

    expect(volumes).toHaveLength(0);
    expect(tipHeight).toBe(ROOF);
  });

  test("reads heights quoted in feet", () => {
    const { tipHeight } = readOsmMassing(
      [part(4, { man_made: "antenna", height: "1454'" }, ring(19, 14, 21, 16))],
      origin,
      footprint,
      ROOF,
    );

    expect(tipHeight).toBeCloseTo(443.2, 0);
  });
});
