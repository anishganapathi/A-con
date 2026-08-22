import type { Opening, Point2D, Wall } from "../types/floorPlan";
import type { BuildingSpec, ZoneSpec } from "./buildingSpec";

/**
 * A floor traced from a plan sheet. The vision model returns loose rectangles
 * that overlap and leave slivers, so they are tidied into a tiling first and
 * the walls, doors, and windows are derived from that tiling — one partition
 * per shared edge, one door per room, and a real front entrance.
 */
export interface MeasuredFloor {
  zones: ZoneSpec[];
  walls: Wall[];
  openings: Opening[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Below this a partition is a sliver, not a room edge. */
const MIN_EDGE = 0.9;
/** A 4'-deep toilet or wash area is a real room on these sheets. */
const MIN_SIDE = 1;
const EXTERIOR_THICKNESS = 0.3;

export function layoutMeasuredFloor(
  spec: BuildingSpec,
  prefix: string,
  exterior: Wall["material"],
  ground = prefix === "",
): MeasuredFloor {
  const zones = tidyZones(spec.zones, spec.width, spec.depth);
  const height = spec.storyHeight;
  const ring = ringWalls(spec, prefix, height, exterior);
  const partitions = partitionWalls(zones, spec.width, spec.depth, prefix, height);
  const walls = [...ring, ...partitions];
  // One booking sheet per wall, so a door and a window never punch the same
  // stretch of masonry.
  const place = wallSlots();
  const openings = [
    ...facadeOpenings(zones, ring, spec, prefix, ground, place),
    ...interiorDoors(zones, partitions, spec, prefix, place),
  ];
  return { zones, walls, openings };
}

/**
 * Squares up the model's rectangles into a tiling.
 *
 * Every room edge becomes a grid line, each cell goes to the room that covers
 * most of it, and each room keeps the largest block of cells it owns. Because
 * cells are owned outright the result cannot overlap, and because a room only
 * loses cells to a room that covered them better, it cannot be squeezed out of
 * existence by a neighbour the model drew too large.
 */
export function tidyZones(zones: ZoneSpec[], width: number, depth: number): ZoneSpec[] {
  const entries = zones
    .map((zone) => ({
      zone,
      rect: fitInside({ x: zone.x, y: zone.y, w: zone.w, h: zone.h }, width, depth),
    }))
    .filter((entry) => entry.rect.w >= MIN_SIDE && entry.rect.h >= MIN_SIDE);
  if (entries.length === 0) {
    return [];
  }

  const xs = gridLines(entries.map((entry) => entry.rect), "x", width);
  const ys = gridLines(entries.map((entry) => entry.rect), "y", depth);
  const columns = xs.length - 1;
  const rows = ys.length - 1;
  if (columns < 1 || rows < 1) {
    return [];
  }

  const owner: number[] = new Array(columns * rows).fill(-1);
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const cell: Rect = {
        x: xs[column],
        y: ys[row],
        w: xs[column + 1] - xs[column],
        h: ys[row + 1] - ys[row],
      };
      const size = cell.w * cell.h;
      const claims = entries
        .map((entry, index) => ({ index, share: overlapArea(cell, entry.rect) }))
        .filter((claim) => claim.share > size * 0.35);
      const strongest = Math.max(0, ...claims.map((claim) => claim.share));
      // When two rooms both cover most of a cell the smaller one needs it more,
      // which is how a parking bay drawn inside a hall keeps its floor.
      const contenders = claims.filter(
        (claim) => claim.share >= Math.min(strongest, size * 0.7) - 0.0001,
      );
      owner[column * rows + row] =
        contenders.sort(
          (a, b) => area(entries[a.index].rect) - area(entries[b.index].rect),
        )[0]?.index ?? -1;
    }
  }

  const tidied = entries
    .map(({ zone }, index) => {
      const block = largestBlock(owner, index, xs, ys);
      return block ? { ...zone, ...blockRect(block, xs, ys) } : null;
    })
    .filter((zone): zone is ZoneSpec => Boolean(zone))
    .filter((zone) => zone.w >= MIN_SIDE && zone.h >= MIN_SIDE);

  return [...tidied, ...fillGaps(owner, xs, ys, entries.length)].sort(
    (a, b) => a.y - b.y || a.x - b.x,
  );
}

/**
 * Floor the model left blank — the stair void on these sheets — becomes
 * circulation. It closes the plate and gives the rooms around it something to
 * open onto, which is what the sheet's landing actually is.
 */
function fillGaps(
  owner: number[],
  xs: number[],
  ys: number[],
  nextIndex: number,
): ZoneSpec[] {
  const rows = ys.length - 1;
  const filled: ZoneSpec[] = [];
  for (let pass = 0; pass < 2; pass += 1) {
    const block = largestBlock(owner, -1, xs, ys);
    if (!block) {
      break;
    }
    const rect = blockRect(block, xs, ys);
    if (rect.w < MIN_SIDE || rect.h < MIN_SIDE || rect.w * rect.h < 2) {
      break;
    }
    const mark = nextIndex + pass;
    for (let column = block.column; column < block.column + block.columns; column += 1) {
      for (let row = block.row; row < block.row + block.rows; row += 1) {
        owner[column * rows + row] = mark;
      }
    }
    filled.push({
      id: `landing-${pass + 1}`,
      name: pass === 0 ? "Landing" : "Passage",
      kind: "circulation",
      ...rect,
    });
  }
  return filled;
}

function blockRect(block: Block, xs: number[], ys: number[]): Rect {
  return {
    x: round(xs[block.column]),
    y: round(ys[block.row]),
    w: round(xs[block.column + block.columns] - xs[block.column]),
    h: round(ys[block.row + block.rows] - ys[block.row]),
  };
}

/** Slides a room back onto the plate before resorting to trimming it. */
function fitInside(rect: Rect, width: number, depth: number): Rect {
  const w = Math.min(rect.w, width);
  const h = Math.min(rect.h, depth);
  return {
    x: Math.min(Math.max(rect.x, 0), width - w),
    y: Math.min(Math.max(rect.y, 0), depth - h),
    w,
    h,
  };
}

function area(rect: Rect): number {
  return rect.w * rect.h;
}

function overlapArea(a: Rect, b: Rect): number {
  const x = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const y = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return x > 0 && y > 0 ? x * y : 0;
}

interface Block {
  column: number;
  row: number;
  columns: number;
  rows: number;
}

/**
 * The biggest rectangle of cells this room owns outright. Counts come from a
 * summed-area table so every candidate rectangle is a constant-time lookup.
 */
function largestBlock(
  owner: number[],
  index: number,
  xs: number[],
  ys: number[],
): Block | null {
  const columns = xs.length - 1;
  const rows = ys.length - 1;
  const stride = rows + 1;
  const sums = new Array((columns + 1) * stride).fill(0);
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const mine = owner[column * rows + row] === index ? 1 : 0;
      sums[(column + 1) * stride + row + 1] =
        mine +
        sums[column * stride + row + 1] +
        sums[(column + 1) * stride + row] -
        sums[column * stride + row];
    }
  }
  const count = (x0: number, y0: number, x1: number, y1: number) =>
    sums[x1 * stride + y1] -
    sums[x0 * stride + y1] -
    sums[x1 * stride + y0] +
    sums[x0 * stride + y0];

  let best: Block | null = null;
  let bestArea = 0;
  for (let x0 = 0; x0 < columns; x0 += 1) {
    for (let x1 = x0 + 1; x1 <= columns; x1 += 1) {
      for (let y0 = 0; y0 < rows; y0 += 1) {
        for (let y1 = y0 + 1; y1 <= rows; y1 += 1) {
          const size = (xs[x1] - xs[x0]) * (ys[y1] - ys[y0]);
          if (size <= bestArea || count(x0, y0, x1, y1) !== (x1 - x0) * (y1 - y0)) {
            continue;
          }
          bestArea = size;
          best = { column: x0, row: y0, columns: x1 - x0, rows: y1 - y0 };
        }
      }
    }
  }
  return best;
}

/** Room edges that sit within a hand's width of each other become one line. */
function gridLines(rects: Rect[], axis: "x" | "y", span: number): number[] {
  const raw = [0, span];
  for (const rect of rects) {
    raw.push(axis === "x" ? rect.x : rect.y);
    raw.push(axis === "x" ? rect.x + rect.w : rect.y + rect.h);
  }
  const sorted = [...raw].sort((a, b) => a - b);
  const lines: number[] = [];
  for (const value of sorted) {
    const last = lines[lines.length - 1];
    if (last === undefined || value - last > 0.55) {
      lines.push(round(value));
    }
  }
  // The far edge has to close the grid. Nudging the last line out to meet it
  // would widen that cell and let a big room outbid a small one for it, so a
  // real gap gets its own line and only rounding noise is absorbed.
  const last = lines[lines.length - 1];
  if (last === undefined) {
    return [0, round(span)];
  }
  if (span - last > 0.15) {
    lines.push(round(span));
  } else if (Math.abs(last - span) > 0.001 && lines.length > 1) {
    lines[lines.length - 1] = round(span);
  }
  return lines;
}

function ringWalls(
  spec: BuildingSpec,
  prefix: string,
  height: number,
  exterior: Wall["material"],
): Wall[] {
  const { width, depth } = spec;
  return [
    ["south", { x: 0, y: 0 }, { x: width, y: 0 }],
    ["east", { x: width, y: 0 }, { x: width, y: depth }],
    ["north", { x: 0, y: depth }, { x: width, y: depth }],
    ["west", { x: 0, y: 0 }, { x: 0, y: depth }],
  ].map(([face, start, end]) =>
    makeWall(
      `${prefix}ext-${face as string}`,
      start as Point2D,
      end as Point2D,
      height,
      "exterior",
      exterior,
    ),
  );
}

interface Segment {
  axis: "v" | "h";
  at: number;
  from: number;
  to: number;
}

/**
 * One wall per shared room edge. Collinear runs are merged so a corridor flanked
 * by four rooms reads as one partition instead of four stacked boxes.
 */
function partitionWalls(
  zones: ZoneSpec[],
  width: number,
  depth: number,
  prefix: string,
  height: number,
): Wall[] {
  const segments: Segment[] = [];
  for (const zone of zones) {
    segments.push(
      { axis: "v", at: zone.x, from: zone.y, to: zone.y + zone.h },
      { axis: "v", at: zone.x + zone.w, from: zone.y, to: zone.y + zone.h },
      { axis: "h", at: zone.y, from: zone.x, to: zone.x + zone.w },
      { axis: "h", at: zone.y + zone.h, from: zone.x, to: zone.x + zone.w },
    );
  }

  const inner = segments.filter((segment) =>
    segment.axis === "v"
      ? segment.at > 0.1 && segment.at < width - 0.1
      : segment.at > 0.1 && segment.at < depth - 0.1,
  );

  const walls: Wall[] = [];
  for (const axis of ["v", "h"] as const) {
    const byLine = new Map<number, Segment[]>();
    for (const segment of inner.filter((entry) => entry.axis === axis)) {
      const key = round(segment.at);
      byLine.set(key, [...(byLine.get(key) ?? []), segment]);
    }
    for (const [at, group] of [...byLine.entries()].sort((a, b) => a[0] - b[0])) {
      for (const [index, run] of mergeRuns(group).entries()) {
        if (run.to - run.from < MIN_EDGE) {
          continue;
        }
        const start = axis === "v" ? { x: at, y: run.from } : { x: run.from, y: at };
        const end = axis === "v" ? { x: at, y: run.to } : { x: run.to, y: at };
        walls.push(
          makeWall(
            `${prefix}int-${axis}${at.toFixed(2)}-${index + 1}`,
            start,
            end,
            height,
            "interior",
          ),
        );
      }
    }
  }
  return walls;
}

/**
 * Books a run of wall for an opening, sliding along from the preferred centre
 * until it finds clear masonry. Returns the offset from the wall start, or null
 * when the wall is already full.
 */
type PlaceOpening = (wall: Wall, center: number, width: number) => number | null;

function wallSlots(): PlaceOpening {
  const booked = new Map<string, [number, number][]>();
  return (wall, center, width) => {
    const length = wallLength(wall);
    const half = width / 2;
    const low = 0.25 + half;
    const high = length - 0.25 - half;
    if (high < low) {
      return null;
    }
    const taken = booked.get(wall.id) ?? [];
    for (let shift = 0; shift <= length; shift += 0.25) {
      for (const at of shift === 0 ? [center] : [center + shift, center - shift]) {
        const middle = Math.min(Math.max(at, low), high);
        const from = middle - half;
        const to = middle + half;
        if (taken.every(([start, end]) => to + 0.15 <= start || from - 0.15 >= end)) {
          booked.set(wall.id, [...taken, [from, to]]);
          return round(from);
        }
      }
    }
    return null;
  };
}

function wallLength(wall: Wall): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

function mergeRuns(segments: Segment[]): { from: number; to: number }[] {
  const sorted = [...segments].sort((a, b) => a.from - b.from);
  const runs: { from: number; to: number }[] = [];
  for (const segment of sorted) {
    const last = runs[runs.length - 1];
    if (last && segment.from <= last.to + 0.12) {
      last.to = Math.max(last.to, segment.to);
      continue;
    }
    runs.push({ from: segment.from, to: segment.to });
  }
  return runs;
}

/**
 * Every room gets exactly one door, onto the hall when it touches one and onto
 * its widest neighbour otherwise. Nothing gets a door per wall.
 */
function interiorDoors(
  zones: ZoneSpec[],
  walls: Wall[],
  spec: BuildingSpec,
  prefix: string,
  place: PlaceOpening,
): Opening[] {
  const hall = zones.find((zone) => zone.kind === "circulation");
  const openings: Opening[] = [];
  const used = new Set<string>();

  for (const zone of zones) {
    if (hall && zone.id === hall.id) {
      continue;
    }
    const neighbours = zones
      .filter((other) => other.id !== zone.id)
      .map((other) => ({ other, share: sharedEdge(zone, other) }))
      .filter((entry) => entry.share && entry.share.span >= MIN_EDGE);
    if (neighbours.length === 0) {
      continue;
    }
    const target =
      (hall && neighbours.find((entry) => entry.other.id === hall.id)) ??
      neighbours.sort((a, b) => (b.share?.span ?? 0) - (a.share?.span ?? 0))[0];
    const share = target.share;
    if (!share) {
      continue;
    }
    const pair = [zone.id, target.other.id].sort().join("|");
    if (used.has(pair)) {
      continue;
    }
    const host = walls.find((entry) => hosts(entry, share));
    if (!host) {
      continue;
    }
    const offset = place(host, offsetAlong(host, share.mid), 0.9);
    if (offset === null) {
      continue;
    }
    used.add(pair);
    openings.push({
      id: `${prefix}door-${zone.id}`,
      wallId: host.id,
      type: "door",
      offsetFromStart: offset,
      width: 0.9,
      height: Math.min(2.1, spec.storyHeight - 0.4),
      sillHeight: 0,
    });
  }
  return openings;
}

interface Share {
  axis: "v" | "h";
  at: number;
  from: number;
  to: number;
  span: number;
  mid: Point2D;
}

function sharedEdge(a: ZoneSpec, b: ZoneSpec): Share | null {
  const vertical = [
    [a.x, b.x + b.w],
    [a.x + a.w, b.x],
  ].find(([one, two]) => Math.abs(one - two) < 0.2);
  if (vertical) {
    const from = Math.max(a.y, b.y);
    const to = Math.min(a.y + a.h, b.y + b.h);
    if (to - from >= MIN_EDGE) {
      const at = round(vertical[0]);
      return { axis: "v", at, from, to, span: to - from, mid: { x: at, y: (from + to) / 2 } };
    }
  }
  const horizontal = [
    [a.y, b.y + b.h],
    [a.y + a.h, b.y],
  ].find(([one, two]) => Math.abs(one - two) < 0.2);
  if (horizontal) {
    const from = Math.max(a.x, b.x);
    const to = Math.min(a.x + a.w, b.x + b.w);
    if (to - from >= MIN_EDGE) {
      const at = round(horizontal[0]);
      return { axis: "h", at, from, to, span: to - from, mid: { x: (from + to) / 2, y: at } };
    }
  }
  return null;
}

function hosts(wall: Wall, share: Share): boolean {
  const vertical = Math.abs(wall.start.x - wall.end.x) < 0.05;
  if (vertical !== (share.axis === "v")) {
    return false;
  }
  if (vertical) {
    return (
      Math.abs(wall.start.x - share.at) < 0.2 &&
      Math.min(wall.start.y, wall.end.y) <= share.mid.y + 0.05 &&
      Math.max(wall.start.y, wall.end.y) >= share.mid.y - 0.05
    );
  }
  return (
    Math.abs(wall.start.y - share.at) < 0.2 &&
    Math.min(wall.start.x, wall.end.x) <= share.mid.x + 0.05 &&
    Math.max(wall.start.x, wall.end.x) >= share.mid.x - 0.05
  );
}

function offsetAlong(wall: Wall, point: Point2D): number {
  return Math.hypot(point.x - wall.start.x, point.y - wall.start.y);
}

/**
 * The front door goes on the entrance room's facade, a garage gets a wide leaf,
 * and every habitable room that reaches the perimeter gets one window.
 */
function facadeOpenings(
  zones: ZoneSpec[],
  ring: Wall[],
  spec: BuildingSpec,
  prefix: string,
  ground: boolean,
  place: PlaceOpening,
): Opening[] {
  const openings: Opening[] = [];
  const doorHeight = Math.min(2.3, spec.storyHeight - 0.4);
  const south = ring.find((wall) => wall.id === `${prefix}ext-south`);
  const garage = ground
    ? zones.find((zone) => /park|garage|carport/i.test(zone.name))
    : undefined;

  // The vehicle bay is booked first so the front door has to work around it,
  // never the other way round.
  if (ground && south && garage && garage.y < 0.2) {
    const width = Math.min(2.6, garage.w - 0.4);
    const offset = place(south, garage.x + garage.w / 2, width);
    if (offset !== null && width >= 1.8) {
      openings.push({
        id: `${prefix}door-garage`,
        wallId: south.id,
        type: "door",
        offsetFromStart: offset,
        width: round(width),
        height: doorHeight,
        sillHeight: 0,
      });
    }
  }

  // A house needs a way in on foot, whatever the sheet labels the front rooms.
  if (ground && south) {
    const entry = entryZone(zones, garage);
    const offset = place(south, entry ? entry.x + entry.w / 2 : spec.width / 2, 1.1);
    if (offset !== null) {
      openings.push({
        id: `${prefix}door-entry`,
        wallId: south.id,
        type: "door",
        offsetFromStart: offset,
        width: 1.1,
        height: doorHeight,
        sillHeight: 0,
      });
    }
  }

  for (const zone of zones) {
    for (const face of facesOf(zone, spec.width, spec.depth)) {
      const wall = ring.find((entry) => entry.id === `${prefix}ext-${face.side}`);
      if (!wall || face.span < 1.8 || zone.kind === "circulation") {
        continue;
      }
      const width = Math.min(spec.windows?.width ?? 1.3, face.span - 0.8);
      if (width < 0.7) {
        continue;
      }
      const offset = place(wall, offsetAlong(wall, face.mid), width);
      if (offset === null) {
        continue;
      }
      openings.push({
        id: `${prefix}win-${zone.id}-${face.side}`,
        wallId: wall.id,
        type: "window",
        offsetFromStart: offset,
        width: round(width),
        height: spec.windows?.height ?? Math.min(1.4, spec.storyHeight - 1.4),
        sillHeight: spec.windows?.sillHeight ?? 0.9,
      });
    }
  }
  return openings;
}

/** Prefers a porch or hall on the facade, then the widest front room. */
function entryZone(zones: ZoneSpec[], garage: ZoneSpec | undefined): ZoneSpec | undefined {
  const front = zones.filter((zone) => zone.y < 0.2 && zone.id !== garage?.id);
  return (
    front.find((zone) => zone.kind === "entry") ??
    front.find((zone) => zone.kind === "circulation") ??
    [...front].sort((a, b) => b.w - a.w)[0]
  );
}

interface Face {
  side: "south" | "east" | "north" | "west";
  span: number;
  mid: Point2D;
}

function facesOf(zone: ZoneSpec, width: number, depth: number): Face[] {
  const faces: Face[] = [];
  if (zone.y < 0.2) {
    faces.push({ side: "south", span: zone.w, mid: { x: zone.x + zone.w / 2, y: 0 } });
  }
  if (zone.y + zone.h > depth - 0.2) {
    faces.push({ side: "north", span: zone.w, mid: { x: zone.x + zone.w / 2, y: depth } });
  }
  if (zone.x < 0.2) {
    faces.push({ side: "west", span: zone.h, mid: { x: 0, y: zone.y + zone.h / 2 } });
  }
  if (zone.x + zone.w > width - 0.2) {
    faces.push({ side: "east", span: zone.h, mid: { x: width, y: zone.y + zone.h / 2 } });
  }
  return faces;
}

function makeWall(
  id: string,
  start: Point2D,
  end: Point2D,
  height: number,
  type: Wall["type"],
  material?: Wall["material"],
): Wall {
  return {
    id,
    start,
    end,
    height,
    thickness: type === "exterior" ? EXTERIOR_THICKNESS : 0.12,
    type,
    material,
  };
}

function round(value: number): number {
  return Math.round(value * 20) / 20;
}
