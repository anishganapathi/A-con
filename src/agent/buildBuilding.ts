import type {
  ElectricalRun,
  Floor,
  FloorPlan,
  Opening,
  PipeRun,
  Room,
  Wall,
} from "../types/floorPlan";
import type { BuildBrief } from "./types";

const STONE = {
  color: "#d7cec0",
  roughness: 0.92,
  metalness: 0.02,
  opacity: 1,
};

function floorName(index: number): string {
  return ["First Floor", "Second Floor", "Third Floor", "Fourth Floor"][index] ??
    `Floor ${index + 1}`;
}

export function defaultBrief(): BuildBrief {
  return {
    name: "New building",
    width: 10,
    depth: 8,
    stories: 2,
    storyHeight: 3.3,
    rooms: ["living", "kitchen", "bath", "bedroom", "hallway"],
    includeMep: true,
  };
}

export function parseBuildBrief(text: string): BuildBrief {
  const brief = defaultBrief();
  const size = text.match(
    /(\d+(?:\.\d+)?)\s*(?:x|by|×)\s*(\d+(?:\.\d+)?)/i,
  );
  if (size) {
    brief.width = Number(size[1]);
    brief.depth = Number(size[2]);
  }
  const stories = text.match(
    /(\d+)\s*(?:stor(?:y|ies)|floor|level)/i,
  );
  if (stories) {
    brief.stories = Math.min(4, Math.max(1, Number(stories[1])));
  } else if (/\bone[\s-]?storey|single[\s-]?stor/i.test(text)) {
    brief.stories = 1;
  } else if (/\bthree[\s-]?stor/i.test(text)) {
    brief.stories = 3;
  } else if (/\btwo[\s-]?stor/i.test(text)) {
    brief.stories = 2;
  }
  const height = text.match(
    /(?:story|floor|ceiling)\s*height\s*(?:of\s*)?(\d+(?:\.\d+)?)/i,
  );
  if (height) {
    brief.storyHeight = Number(height[1]);
  }
  const named = text.match(/(?:called|named|project)\s+["']?([^"'\n,.]+)/i);
  if (named?.[1]) {
    brief.name = named[1].trim();
    brief.project = named[1].trim();
  }
  const rooms: string[] = [];
  if (/living|lounge/i.test(text)) {
    rooms.push("living");
  }
  if (/kitchen/i.test(text)) {
    rooms.push("kitchen");
  }
  if (/bath|powder|wc/i.test(text)) {
    rooms.push("bath");
  }
  const bedroomCount = text.match(/(\d+)\s*bed/i);
  if (bedroomCount) {
    const count = Math.min(3, Number(bedroomCount[1]));
    for (let i = 0; i < count; i += 1) {
      rooms.push(i === 0 ? "bedroom" : `bedroom-${i + 1}`);
    }
  } else if (/bedroom|bed /i.test(text)) {
    rooms.push("bedroom");
  }
  if (/office|study/i.test(text)) {
    rooms.push("office");
  }
  if (/hall/i.test(text) || rooms.length > 1) {
    rooms.push("hallway");
  }
  if (rooms.length > 0) {
    brief.rooms = [...new Set(rooms)];
  }
  if (/no mep|without (?:pipes|electrical|mep)/i.test(text)) {
    brief.includeMep = false;
  }
  return brief;
}

export function buildBuilding(brief: BuildBrief): FloorPlan {
  const width = Math.max(6, brief.width);
  const depth = Math.max(6, brief.depth);
  const stories = Math.min(4, Math.max(1, brief.stories));
  const storyHeight = Math.max(2.6, brief.storyHeight);
  const floors: Floor[] = [];
  let elevation = 0;

  for (let index = 0; index < stories; index += 1) {
    const id = index === 0 ? "l1" : `l${index + 1}`;
    const prefix = index === 0 ? "" : id;
    const label = index === 0 ? "" : `L${index + 1} `;
    const height = index === 0 ? Math.max(storyHeight, 3.2) : storyHeight;
    floors.push(
      buildFloor({
        id,
        name: floorName(index),
        elevation,
        height,
        width,
        depth,
        prefix,
        label,
        rooms: brief.rooms,
        includeMep: brief.includeMep,
        storefront: index === 0,
      }),
    );
    elevation += height;
  }

  const eave = elevation + 0.35;
  const ridge = eave + 1.6;
  const name = brief.name ?? "New building";

  return {
    name,
    units: "meters",
    source: {
      project: brief.project ?? name,
      sheet: "A2.2",
      title: "Building Elevations · 3D composite",
      notes:
        brief.notes ??
        `Constructed from chat brief · ${width} × ${depth} m · ${stories} stor${stories === 1 ? "y" : "ies"}.`,
    },
    datums: [
      { id: "ff-1", name: "F.F. FIRST FLOOR", elevation: 0 },
      ...floors.slice(1).map((floor, index) => ({
        id: `ff-${index + 2}`,
        name: `F.F. ${floor.name.toUpperCase()}`,
        elevation: floor.elevation,
      })),
      { id: "parapet", name: "T.O. PARAPET", elevation: eave },
      { id: "roof", name: "T.O. ROOF", elevation: ridge },
    ],
    roof: {
      type: "standing-seam",
      eaveHeight: eave,
      ridgeHeight: ridge,
      overhang: 0.45,
    },
    floors,
  };
}

function buildFloor({
  id,
  name,
  elevation,
  height,
  width,
  depth,
  prefix,
  label,
  rooms,
  includeMep,
  storefront,
}: {
  id: string;
  name: string;
  elevation: number;
  height: number;
  width: number;
  depth: number;
  prefix: string;
  label: string;
  rooms: string[];
  includeMep: boolean;
  storefront: boolean;
}): Floor {
  const uid = (key: string) => (prefix ? `${prefix}-${key}` : key);
  const livingY = depth * 0.55;
  const hallLeft = width * 0.38;
  const hallRight = width * 0.52;
  const kitchenY = depth * 0.275;
  const bathY = depth * 0.325;

  const walls: Wall[] = [
    wall(uid("ext-south"), { x: 0, y: 0 }, { x: width, y: 0 }, height, "exterior"),
    wall(uid("ext-east"), { x: width, y: 0 }, { x: width, y: depth }, height, "exterior"),
    wall(uid("ext-north"), { x: 0, y: depth }, { x: width, y: depth }, height, "exterior"),
    wall(uid("ext-west"), { x: 0, y: 0 }, { x: 0, y: depth }, height, "exterior"),
    wall(
      uid("int-living-south"),
      { x: 0, y: livingY },
      { x: width, y: livingY },
      height,
      "interior",
    ),
    wall(
      uid("int-hall-west"),
      { x: hallLeft, y: 0 },
      { x: hallLeft, y: livingY },
      height,
      "interior",
    ),
    wall(
      uid("int-hall-east"),
      { x: hallRight, y: 0 },
      { x: hallRight, y: livingY },
      height,
      "interior",
    ),
    wall(
      uid("part-kitchen-br1"),
      { x: 0, y: kitchenY },
      { x: hallLeft, y: kitchenY },
      height,
      "partition",
    ),
    wall(
      uid("part-bath-br2"),
      { x: hallRight, y: bathY },
      { x: width, y: bathY },
      height,
      "partition",
    ),
  ];

  const openings: Opening[] = [
    {
      id: uid(storefront ? "door-entry" : "win-entry-bay"),
      wallId: uid("ext-south"),
      type: storefront ? "door" : "window",
      offsetFromStart: width / 2 - 0.6,
      width: storefront ? 1.2 : 1.2,
      height: storefront ? 2.4 : 1.5,
      sillHeight: storefront ? 0 : 0.9,
    },
    door(uid("door-living"), uid("int-living-south"), width / 2 - 0.45),
    door(uid("door-br1"), uid("int-hall-west"), 1.1),
    door(uid("door-br2"), uid("int-hall-east"), 0.85),
    door(uid("door-bath"), uid("int-hall-east"), livingY - 1.35),
    door(uid("door-kitchen"), uid("int-hall-west"), livingY - 1.35),
    window(uid("win-s-br1"), uid("ext-south"), width * 0.14, storefront),
    window(uid("win-s-br2"), uid("ext-south"), width * 0.7, storefront),
    window(uid("win-n-living"), uid("ext-north"), width * 0.18, storefront),
    window(uid("win-e"), uid("ext-east"), depth * 0.55, storefront),
    window(uid("win-w"), uid("ext-west"), depth * 0.38, storefront),
  ];

  const builtRooms: Room[] = [
    room(
      uid("living"),
      `${label}Living Room`,
      [
        { x: 0, y: livingY },
        { x: width, y: livingY },
        { x: width, y: depth },
        { x: 0, y: depth },
      ],
    ),
    room(
      uid("kitchen"),
      `${label}Kitchen`,
      [
        { x: 0, y: kitchenY },
        { x: hallLeft, y: kitchenY },
        { x: hallLeft, y: livingY },
        { x: 0, y: livingY },
      ],
    ),
    room(
      uid("bedroom-1"),
      `${label}Bedroom 1`,
      [
        { x: 0, y: 0 },
        { x: hallLeft, y: 0 },
        { x: hallLeft, y: kitchenY },
        { x: 0, y: kitchenY },
      ],
    ),
    room(
      uid("hallway"),
      `${label}Hallway`,
      [
        { x: hallLeft, y: 0 },
        { x: hallRight, y: 0 },
        { x: hallRight, y: livingY },
        { x: hallLeft, y: livingY },
      ],
    ),
    room(
      uid("bedroom-2"),
      `${label}Bedroom 2`,
      [
        { x: hallRight, y: 0 },
        { x: width, y: 0 },
        { x: width, y: bathY },
        { x: hallRight, y: bathY },
      ],
    ),
    room(
      uid("bathroom"),
      `${label}Bathroom`,
      [
        { x: hallRight, y: bathY },
        { x: width, y: bathY },
        { x: width, y: livingY },
        { x: hallRight, y: livingY },
      ],
    ),
  ].filter((entry) =>
    rooms.some((wanted) => {
      const key = wanted.toLowerCase();
      return (
        entry.id.includes(key) ||
        entry.name.toLowerCase().includes(key) ||
        (key === "bedroom" && entry.id.includes("bedroom")) ||
        (key === "bath" && entry.id.includes("bath"))
      );
    }),
  );

  const officeWanted = rooms.some((entry) => /office|study/i.test(entry));
  if (officeWanted && !builtRooms.some((entry) => entry.id.includes("office"))) {
    builtRooms.push(
      room(
        uid("office"),
        `${label}Office`,
        [
          { x: width * 0.62, y: livingY },
          { x: width, y: livingY },
          { x: width, y: depth },
          { x: width * 0.62, y: depth },
        ],
      ),
    );
  }

  return {
    id,
    name,
    elevation,
    walls,
    openings,
    rooms: builtRooms,
    dimensions:
      elevation === 0
        ? [
            {
              id: "dim-overall-width",
              from: { x: 0, y: -0.7 },
              to: { x: width, y: -0.7 },
              label: `${width.toFixed(2)} m`,
            },
            {
              id: "dim-overall-depth",
              from: { x: -0.7, y: 0 },
              to: { x: -0.7, y: depth },
              label: `${depth.toFixed(2)} m`,
            },
          ]
        : [],
    pipes: includeMep ? plumbing(prefix, height, width, depth) : [],
    electrical: includeMep ? electrical(prefix, height, width, depth) : [],
  };
}

function wall(
  id: string,
  start: Wall["start"],
  end: Wall["end"],
  height: number,
  type: Wall["type"],
): Wall {
  return {
    id,
    start,
    end,
    height,
    thickness: type === "exterior" ? 0.3 : 0.1,
    type,
    material: type === "exterior" ? STONE : undefined,
  };
}

function door(id: string, wallId: string, offset: number): Opening {
  return {
    id,
    wallId,
    type: "door",
    offsetFromStart: Math.max(0.2, offset),
    width: 0.9,
    height: 2.1,
    sillHeight: 0,
  };
}

function window(
  id: string,
  wallId: string,
  offset: number,
  storefront: boolean,
): Opening {
  return {
    id,
    wallId,
    type: "window",
    offsetFromStart: Math.max(0.3, offset),
    width: storefront ? 1.5 : 1.2,
    height: storefront ? 2.1 : 1.3,
    sillHeight: storefront ? 0.4 : 0.95,
  };
}

function room(id: string, name: string, boundary: Room["boundary"]): Room {
  const xs = boundary.map((point) => point.x);
  const ys = boundary.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    id,
    name,
    boundary,
    floorHeight: 0,
    labelPosition: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    areaSqM: Number(((maxX - minX) * (maxY - minY)).toFixed(2)),
  };
}

function plumbing(
  prefix: string,
  ceiling: number,
  width: number,
  depth: number,
): PipeRun[] {
  const id = (name: string) => (prefix ? `${prefix}-${name}` : name);
  const hang = Math.min(2.55, ceiling - 0.45);
  const stackX = width - 0.65;
  const stackY = depth * 0.44;
  return [
    {
      id: id("pipe-stack-waste"),
      name: "Waste / soil stack",
      system: "waste",
      diameter: 0.1,
      points: [
        { x: stackX, y: stackY, height: 0.12 },
        { x: stackX, y: stackY, height: ceiling },
      ],
    },
    {
      id: id("pipe-stack-supply"),
      name: "Supply riser",
      system: "supply",
      diameter: 0.04,
      points: [
        { x: stackX - 0.07, y: stackY + 0.08, height: 0.12 },
        { x: stackX - 0.07, y: stackY + 0.08, height: ceiling },
      ],
    },
    {
      id: id("pipe-supply-kitchen"),
      name: "Cold water — kitchen",
      system: "supply",
      diameter: 0.032,
      points: [
        { x: stackX, y: stackY, height: hang },
        { x: width * 0.12, y: stackY, height: hang },
        { x: width * 0.12, y: depth * 0.38, height: 0.85 },
      ],
    },
    {
      id: id("pipe-waste-kitchen"),
      name: "Waste — kitchen",
      system: "waste",
      diameter: 0.05,
      points: [
        { x: width * 0.12, y: depth * 0.38, height: 0.22 },
        { x: stackX, y: stackY, height: 0.22 },
      ],
    },
    {
      id: id("pipe-supply-bath"),
      name: "Cold water — bath",
      system: "supply",
      diameter: 0.028,
      points: [
        { x: stackX, y: stackY, height: hang - 0.15 },
        { x: width * 0.82, y: stackY, height: 1.05 },
      ],
    },
    {
      id: id("pipe-waste-bath"),
      name: "Waste — bath",
      system: "waste",
      diameter: 0.075,
      points: [
        { x: width * 0.86, y: depth * 0.4, height: 0.22 },
        { x: stackX, y: stackY, height: 0.22 },
      ],
    },
  ];
}

function electrical(
  prefix: string,
  ceiling: number,
  width: number,
  depth: number,
): ElectricalRun[] {
  const id = (name: string) => (prefix ? `${prefix}-${name}` : name);
  const light = Math.min(2.45, ceiling - 0.5);
  const riserX = width * 0.45;
  const riserY = depth * 0.27;
  return [
    {
      id: id("elec-riser"),
      name: "Electrical riser",
      circuit: "power",
      diameter: 0.04,
      points: [
        { x: riserX, y: riserY, height: 0.12 },
        { x: riserX, y: riserY, height: ceiling },
      ],
    },
    {
      id: id("elec-lighting"),
      name: "Lighting circuit",
      circuit: "lighting",
      diameter: 0.02,
      points: [
        { x: riserX, y: riserY, height: light },
        { x: riserX, y: depth * 0.78, height: light },
        { x: width * 0.74, y: depth * 0.78, height: light },
      ],
    },
    {
      id: id("elec-power-kitchen"),
      name: "Power — kitchen",
      circuit: "power",
      diameter: 0.022,
      points: [
        { x: riserX, y: riserY, height: 0.38 },
        { x: width * 0.08, y: depth * 0.41, height: 0.38 },
        { x: width * 0.08, y: depth * 0.41, height: 1.05 },
      ],
    },
    {
      id: id("elec-data"),
      name: "Data",
      circuit: "data",
      diameter: 0.018,
      points: [
        { x: riserX, y: riserY, height: light - 0.18 },
        { x: width * 0.86, y: depth * 0.8, height: light - 0.18 },
      ],
    },
  ];
}
