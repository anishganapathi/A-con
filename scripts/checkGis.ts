/** Smoke check: NYC GIS record -> BuildingSpec -> FloorPlan geometry budget. */
import { compileSpec } from "../src/agent/compileSpec";
import { describeGis, specFromGis, type GisBuilding } from "../src/agent/gisBuilding";

const query = process.argv[2] ?? "Empire State Building";
const origin = process.argv[3] ?? "http://localhost:5173";

const response = await fetch(`${origin}/api/gis`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
if (!response.ok) {
  const failure = (await response.json()) as { error?: string };
  throw new Error(failure.error ?? `lookup failed ${response.status}`);
}
const building = (await response.json()) as GisBuilding;

const spec = specFromGis(building);
const plan = compileSpec(spec);

const walls = plan.floors.reduce((sum, floor) => sum + floor.walls.length, 0);
const rooms = plan.floors.reduce((sum, floor) => sum + floor.rooms.length, 0);
const openings = plan.floors.reduce((sum, floor) => sum + floor.openings.length, 0);
const pipes = plan.floors.reduce((sum, floor) => sum + floor.pipes.length, 0);
const electrical = plan.floors.reduce((sum, floor) => sum + floor.electrical.length, 0);
const top = plan.floors[plan.floors.length - 1];

const xs = plan.floors[0].walls.flatMap((wall) => [wall.start.x, wall.end.x]);
const ys = plan.floors[0].walls.flatMap((wall) => [wall.start.y, wall.end.y]);

console.log(describeGis(building));
console.log();
console.log("plan name     ", plan.name);
console.log("sheet         ", plan.source.sheet, "|", plan.source.title);
console.log("floors        ", plan.floors.length);
console.log("top elevation ", top.elevation.toFixed(1), "m + storey =", (top.elevation + spec.storyHeight!).toFixed(1), "m");
console.log("roof ridge    ", plan.roof.ridgeHeight.toFixed(1), "m  (source height", building.heightRoofM, "m)");
console.log("plate extent  ", (Math.max(...xs) - Math.min(...xs)).toFixed(1), "x", (Math.max(...ys) - Math.min(...ys)).toFixed(1), "m");
console.log("datums        ", plan.datums.length);
console.log();
console.log("geometry budget");
console.log("  walls        ", walls, `(${(walls / plan.floors.length).toFixed(1)}/floor)`);
console.log("  rooms        ", rooms, `(${(rooms / plan.floors.length).toFixed(1)}/floor)`);
console.log("  openings     ", openings);
console.log("  pipes        ", pipes);
console.log("  electrical   ", electrical);
console.log("  TOTAL        ", walls + rooms + openings + pipes + electrical);
console.log();
console.log("ground floor rooms:");
for (const room of plan.floors[0].rooms) {
  console.log(`  ${room.name.padEnd(28)} ${String(room.areaSqM).padStart(8)} m²  ${room.boundary.length} pts`);
}

const ids = new Set<string>();
let duplicates = 0;
for (const floor of plan.floors) {
  for (const item of [...floor.walls, ...floor.rooms, ...floor.openings, ...floor.pipes, ...floor.electrical]) {
    if (ids.has(item.id)) {
      duplicates += 1;
    }
    ids.add(item.id);
  }
}
console.log();
console.log("duplicate ids ", duplicates === 0 ? "none" : duplicates);

const area = (points: { x: number; y: number }[]) => {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum / 2);
};
const plateAt = (index: number) => {
  const ring = plan.floors[index].walls.filter((w) => w.type === "exterior");
  return area(ring.map((w) => w.start));
};
const modelled = plan.floors.reduce((sum, _, index) => sum + plateAt(index), 0);
console.log();
console.log("setback check");
console.log("  base plate   ", plateAt(0).toFixed(0), "m²");
console.log("  mid plate    ", plateAt(Math.floor(plan.floors.length / 2)).toFixed(0), "m²");
console.log("  top plate    ", plateAt(plan.floors.length - 1).toFixed(0), "m²");
console.log("  modelled GFA ", modelled.toFixed(0), "m²");
console.log("  PLUTO GFA    ", (building.areas.building * 0.092903).toFixed(0), "m²");
const profile = plan.floors
  .map((_, index) => plateAt(index).toFixed(0))
  .filter((value, index, all) => index === 0 || value !== all[index - 1]);
console.log("  distinct plates", profile.join(" -> "), "m²");

const degenerate = plan.floors[0].walls.filter(
  (wall) => Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y) < 0.01,
);
console.log("zero-length walls", degenerate.length);
