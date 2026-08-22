import type {
  ElectricalRun,
  Floor,
  FloorPlan,
  Opening,
  PipeRun,
  Wall,
} from "../types/floorPlan";

const L1_HEIGHT = 3.6;
const L2_HEIGHT = 3.2;
const L3_HEIGHT = 3.2;
const L2_ELEV = 3.6;
const L3_ELEV = 6.8;
const EAVE = 10.15;
const RIDGE = 11.9;
const EXTERIOR_THICKNESS = 0.3;
const INTERIOR_THICKNESS = 0.1;
const PARTITION_THICKNESS = 0.1;

const stone = {
  color: "#d7cec0",
  roughness: 0.92,
  metalness: 0.02,
  opacity: 1,
};

function exterior(
  id: string,
  start: Wall["start"],
  end: Wall["end"],
  height: number,
): Wall {
  return {
    id,
    start,
    end,
    height,
    thickness: EXTERIOR_THICKNESS,
    type: "exterior",
    material: stone,
  };
}

function interior(
  id: string,
  start: Wall["start"],
  end: Wall["end"],
  height: number,
  partition = false,
): Wall {
  return {
    id,
    start,
    end,
    height,
    thickness: partition ? PARTITION_THICKNESS : INTERIOR_THICKNESS,
    type: partition ? "partition" : "interior",
  };
}

function layoutWalls(prefix: string, height: number): Wall[] {
  const id = (name: string) => (prefix ? `${prefix}-${name}` : name);
  return [
    exterior(id("ext-south"), { x: 0, y: 0 }, { x: 10, y: 0 }, height),
    exterior(id("ext-east"), { x: 10, y: 0 }, { x: 10, y: 8 }, height),
    exterior(id("ext-north"), { x: 0, y: 8 }, { x: 10, y: 8 }, height),
    exterior(id("ext-west"), { x: 0, y: 0 }, { x: 0, y: 8 }, height),
    interior(id("int-living-south"), { x: 0, y: 4.4 }, { x: 10, y: 4.4 }, height),
    interior(id("int-hall-west"), { x: 3.8, y: 0 }, { x: 3.8, y: 4.4 }, height),
    interior(id("int-hall-east"), { x: 5.2, y: 0 }, { x: 5.2, y: 4.4 }, height),
    interior(id("part-kitchen-br1"), { x: 0, y: 2.2 }, { x: 3.8, y: 2.2 }, height, true),
    interior(id("part-bath-br2"), { x: 5.2, y: 2.6 }, { x: 10, y: 2.6 }, height, true),
  ];
}

function interiorDoors(prefix: string): Opening[] {
  const id = (name: string) => (prefix ? `${prefix}-${name}` : name);
  return [
    {
      id: id("door-living"),
      wallId: id("int-living-south"),
      type: "door",
      offsetFromStart: 4.15,
      width: 0.9,
      height: 2.1,
      sillHeight: 0,
    },
    {
      id: id("door-kitchen"),
      wallId: id("int-hall-west"),
      type: "door",
      offsetFromStart: 2.75,
      width: 0.8,
      height: 2.1,
      sillHeight: 0,
    },
    {
      id: id("door-br1"),
      wallId: id("int-hall-west"),
      type: "door",
      offsetFromStart: 0.7,
      width: 0.8,
      height: 2.1,
      sillHeight: 0,
    },
    {
      id: id("door-br2"),
      wallId: id("int-hall-east"),
      type: "door",
      offsetFromStart: 0.85,
      width: 0.8,
      height: 2.1,
      sillHeight: 0,
    },
    {
      id: id("door-bath"),
      wallId: id("int-hall-east"),
      type: "door",
      offsetFromStart: 3.05,
      width: 0.75,
      height: 2.1,
      sillHeight: 0,
    },
  ];
}

function elevationWindows(
  prefix: string,
  kind: "storefront" | "upper",
): Opening[] {
  const id = (name: string) => (prefix ? `${prefix}-${name}` : name);
  const sill = kind === "storefront" ? 0.45 : 0.9;
  const height = kind === "storefront" ? 2.4 : 1.5;
  const width = kind === "storefront" ? 1.7 : 1.4;
  return [
    {
      id: id("win-n1"),
      wallId: id("ext-north"),
      type: "window",
      offsetFromStart: 1.5,
      width,
      height,
      sillHeight: sill,
    },
    {
      id: id("win-n2"),
      wallId: id("ext-north"),
      type: "window",
      offsetFromStart: 6.5,
      width,
      height,
      sillHeight: sill,
    },
    {
      id: id("win-s1"),
      wallId: id("ext-south"),
      type: "window",
      offsetFromStart: 0.9,
      width: 1.4,
      height: kind === "storefront" ? 1.5 : 1.4,
      sillHeight: kind === "storefront" ? 0.9 : 0.9,
    },
    {
      id: id("win-s2"),
      wallId: id("ext-south"),
      type: "window",
      offsetFromStart: 6.8,
      width: 1.5,
      height: kind === "storefront" ? 1.5 : 1.4,
      sillHeight: 0.9,
    },
    {
      id: id("win-e"),
      wallId: id("ext-east"),
      type: "window",
      offsetFromStart: kind === "storefront" ? 5.4 : 3.2,
      width: kind === "storefront" ? 1.6 : 1.3,
      height,
      sillHeight: sill,
    },
    {
      id: id("win-w"),
      wallId: id("ext-west"),
      type: "window",
      offsetFromStart: kind === "storefront" ? 2.6 : 3.2,
      width: 1.2,
      height: kind === "storefront" ? 1.4 : 1.3,
      sillHeight: kind === "storefront" ? 1.0 : 0.95,
    },
  ];
}

function roomsFor(prefix: string, namePrefix: string): Floor["rooms"] {
  const id = (name: string) => (prefix ? `${prefix}-${name}` : name);
  const label = (name: string) => (namePrefix ? `${namePrefix}${name}` : name);
  return [
    {
      id: id("living"),
      name: label("Living Room"),
      boundary: [
        { x: 0, y: 4.4 },
        { x: 10, y: 4.4 },
        { x: 10, y: 8 },
        { x: 0, y: 8 },
      ],
      floorHeight: 0,
      labelPosition: { x: 5, y: 6.2 },
      areaSqM: 36.0,
    },
    {
      id: id("kitchen"),
      name: label("Kitchen"),
      boundary: [
        { x: 0, y: 2.2 },
        { x: 3.8, y: 2.2 },
        { x: 3.8, y: 4.4 },
        { x: 0, y: 4.4 },
      ],
      floorHeight: 0,
      labelPosition: { x: 1.9, y: 3.3 },
      areaSqM: 8.36,
    },
    {
      id: id("bedroom-1"),
      name: label("Bedroom 1"),
      boundary: [
        { x: 0, y: 0 },
        { x: 3.8, y: 0 },
        { x: 3.8, y: 2.2 },
        { x: 0, y: 2.2 },
      ],
      floorHeight: 0,
      labelPosition: { x: 1.9, y: 1.1 },
      areaSqM: 8.36,
    },
    {
      id: id("hallway"),
      name: label("Hallway"),
      boundary: [
        { x: 3.8, y: 0 },
        { x: 5.2, y: 0 },
        { x: 5.2, y: 4.4 },
        { x: 3.8, y: 4.4 },
      ],
      floorHeight: 0,
      labelPosition: { x: 4.5, y: 2.2 },
      areaSqM: 6.16,
    },
    {
      id: id("bedroom-2"),
      name: label("Bedroom 2"),
      boundary: [
        { x: 5.2, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 2.6 },
        { x: 5.2, y: 2.6 },
      ],
      floorHeight: 0,
      labelPosition: { x: 7.6, y: 1.3 },
      areaSqM: 12.48,
    },
    {
      id: id("bathroom"),
      name: label("Bathroom"),
      boundary: [
        { x: 5.2, y: 2.6 },
        { x: 10, y: 2.6 },
        { x: 10, y: 4.4 },
        { x: 5.2, y: 4.4 },
      ],
      floorHeight: 0,
      labelPosition: { x: 7.6, y: 3.5 },
      areaSqM: 8.64,
    },
  ];
}

function plumbingLaterals(prefix: string, ceiling: number): PipeRun[] {
  const id = (name: string) => (prefix ? `${prefix}-${name}` : name);
  const hang = Math.min(2.55, ceiling - 0.45);
  return [
    {
      id: id("pipe-supply-kitchen"),
      name: "Cold water — kitchen",
      system: "supply",
      diameter: 0.032,
      points: [
        { x: 9.35, y: 3.5, height: hang },
        { x: 4.5, y: 3.5, height: hang },
        { x: 1.15, y: 3.5, height: hang },
        { x: 1.15, y: 3.05, height: hang },
        { x: 1.15, y: 3.05, height: 0.85 },
      ],
    },
    {
      id: id("pipe-supply-bath"),
      name: "Cold water — bath",
      system: "supply",
      diameter: 0.028,
      points: [
        { x: 9.35, y: 3.5, height: hang - 0.15 },
        { x: 8.15, y: 3.5, height: hang - 0.15 },
        { x: 8.15, y: 3.5, height: 1.05 },
      ],
    },
    {
      id: id("pipe-waste-bath"),
      name: "Waste — bath",
      system: "waste",
      diameter: 0.075,
      points: [
        { x: 8.55, y: 3.15, height: 0.22 },
        { x: 9.35, y: 3.15, height: 0.22 },
        { x: 9.35, y: 3.5, height: 0.22 },
      ],
    },
    {
      id: id("pipe-waste-kitchen"),
      name: "Waste — kitchen",
      system: "waste",
      diameter: 0.05,
      points: [
        { x: 1.2, y: 3.05, height: 0.22 },
        { x: 3.9, y: 3.05, height: 0.22 },
        { x: 4.5, y: 3.5, height: 0.22 },
        { x: 9.35, y: 3.5, height: 0.22 },
      ],
    },
    {
      id: id("pipe-vent"),
      name: "Vent",
      system: "vent",
      diameter: 0.04,
      points: [
        { x: 9.35, y: 3.5, height: hang + 0.2 },
        { x: 9.35, y: 4.2, height: hang + 0.2 },
        { x: 9.35, y: 4.2, height: ceiling - 0.15 },
      ],
    },
    {
      id: id("pipe-stack-waste"),
      name: "Waste / soil stack",
      system: "waste",
      diameter: 0.1,
      points: [
        { x: 9.35, y: 3.5, height: 0.12 },
        { x: 9.35, y: 3.5, height: ceiling },
      ],
    },
    {
      id: id("pipe-stack-supply"),
      name: "Supply riser",
      system: "supply",
      diameter: 0.04,
      points: [
        { x: 9.28, y: 3.58, height: 0.12 },
        { x: 9.28, y: 3.58, height: ceiling },
      ],
    },
  ];
}

function electricalLaterals(prefix: string, ceiling: number): ElectricalRun[] {
  const id = (name: string) => (prefix ? `${prefix}-${name}` : name);
  const light = Math.min(2.45, ceiling - 0.5);
  return [
    {
      id: id("elec-lighting"),
      name: "Lighting circuit",
      circuit: "lighting",
      diameter: 0.02,
      points: [
        { x: 4.5, y: 2.15, height: light },
        { x: 4.5, y: 6.2, height: light },
        { x: 7.4, y: 6.2, height: light },
        { x: 2.4, y: 6.2, height: light },
      ],
    },
    {
      id: id("elec-power-kitchen"),
      name: "Power — kitchen",
      circuit: "power",
      diameter: 0.022,
      points: [
        { x: 4.5, y: 2.15, height: 0.38 },
        { x: 4.5, y: 3.3, height: 0.38 },
        { x: 0.25, y: 3.3, height: 0.38 },
        { x: 0.25, y: 3.3, height: 1.05 },
      ],
    },
    {
      id: id("elec-data"),
      name: "Data",
      circuit: "data",
      diameter: 0.018,
      points: [
        { x: 4.5, y: 2.15, height: light - 0.18 },
        { x: 5.8, y: 2.15, height: light - 0.18 },
        { x: 5.8, y: 6.4, height: light - 0.18 },
        { x: 8.6, y: 6.4, height: light - 0.18 },
      ],
    },
    {
      id: id("elec-riser"),
      name: "Electrical riser",
      circuit: "power",
      diameter: 0.04,
      points: [
        { x: 4.5, y: 2.15, height: 0.12 },
        { x: 4.5, y: 2.15, height: ceiling },
      ],
    },
  ];
}

const firstFloor: Floor = {
  id: "l1",
  name: "First Floor",
  elevation: 0,
  walls: layoutWalls("", L1_HEIGHT),
  openings: [
    {
      id: "door-entry",
      wallId: "ext-south",
      type: "door",
      offsetFromStart: 4.05,
      width: 1.2,
      height: 2.4,
      sillHeight: 0,
    },
    ...interiorDoors(""),
    ...elevationWindows("", "storefront"),
  ],
  rooms: roomsFor("", ""),
  dimensions: [
    {
      id: "dim-overall-width",
      from: { x: 0, y: -0.7 },
      to: { x: 10, y: -0.7 },
      label: "10.00 m",
    },
    {
      id: "dim-overall-depth",
      from: { x: -0.7, y: 0 },
      to: { x: -0.7, y: 8 },
      label: "8.00 m",
    },
    {
      id: "dim-living-depth",
      from: { x: 10.6, y: 4.4 },
      to: { x: 10.6, y: 8 },
      label: "3.60 m",
    },
    {
      id: "dim-kitchen-width",
      from: { x: 0, y: 4.7 },
      to: { x: 3.8, y: 4.7 },
      label: "3.80 m",
    },
    {
      id: "dim-hall-width",
      from: { x: 3.8, y: -0.35 },
      to: { x: 5.2, y: -0.35 },
      label: "1.40 m",
    },
    {
      id: "dim-br2-width",
      from: { x: 5.2, y: -0.35 },
      to: { x: 10, y: -0.35 },
      label: "4.80 m",
    },
  ],
  pipes: plumbingLaterals("", L1_HEIGHT),
  electrical: electricalLaterals("", L1_HEIGHT),
};

function upperFloor(
  id: string,
  name: string,
  elevation: number,
  height: number,
  labelPrefix: string,
): Floor {
  return {
    id,
    name,
    elevation,
    walls: layoutWalls(id, height),
    openings: [
      {
        id: `${id}-win-entry-bay`,
        wallId: `${id}-ext-south`,
        type: "window",
        offsetFromStart: 4.15,
        width: 1.2,
        height: 1.5,
        sillHeight: 0.9,
      },
      ...interiorDoors(id),
      ...elevationWindows(id, "upper"),
    ],
    rooms: roomsFor(id, labelPrefix),
    dimensions: [],
    pipes: plumbingLaterals(id, height),
    electrical: electricalLaterals(id, height),
  };
}

/**
 * Three-story mock as if composed from a floor plan + elevation sheet
 * (window bays, floor-to-floor datums, standing-seam roof).
 */
export const mockFloorPlan: FloorPlan = {
  name: "Bldg. A — Lakeside at the Waterfront",
  units: "meters",
  source: {
    project: "Lakeside at the Waterfront",
    sheet: "A2.2",
    title: "Building Elevations · 3D composite",
    notes: "Mock extraction from plan + elevation datums (F.F. / T.O. roof).",
  },
  datums: [
    { id: "ff-1", name: "F.F. FIRST FLOOR", elevation: 0 },
    { id: "tow-1", name: "T.O. WINDOW / LEDGE", elevation: 2.85 },
    { id: "ff-2", name: "F.F. SECOND FLOOR", elevation: L2_ELEV },
    { id: "ff-3", name: "F.F. THIRD FLOOR", elevation: L3_ELEV },
    { id: "parapet", name: "T.O. PARAPET", elevation: EAVE },
    { id: "roof", name: "T.O. ROOF", elevation: RIDGE },
  ],
  roof: {
    type: "standing-seam",
    eaveHeight: EAVE,
    ridgeHeight: RIDGE,
    overhang: 0.45,
  },
  floors: [
    firstFloor,
    upperFloor("l2", "Second Floor", L2_ELEV, L2_HEIGHT, "L2 "),
    upperFloor("l3", "Third Floor", L3_ELEV, L3_HEIGHT, "L3 "),
  ],
};
