import type { Floor, FloorPlan, Opening, ViewOptions, Wall, WallSegment } from "../types/floorPlan";
import { useConstruction } from "../editor/ConstructionContext";
import { DatumLabels } from "./DatumLabels";
import { DimensionLabel } from "./DimensionLabel";
import { FacadeGlazing } from "./FacadeGlazing";
import { Room } from "./Room";
import { StandingSeamRoof } from "./StandingSeamRoof";
import { UtilityRun } from "./UtilityRun";
import { Wall as WallMesh } from "./Wall";

/** Above this floor count, room labels follow the active floor only. */
const LABELLED_FLOOR_MAX = 4;

interface BuildingModelProps {
  plan: FloorPlan;
  options: ViewOptions;
}

export function BuildingModel({ plan, options }: BuildingModelProps) {
  const construction = useConstruction();
  const floors = options.showAllFloors
    ? plan.floors
    : plan.floors.filter((floor) => floor.id === options.floorId);
  const bounds = getPlanBounds(plan);
  const lastFloor = plan.floors[plan.floors.length - 1];
  // Setback towers taper, so the roof caps the top plate rather than the base.
  const roofBounds = lastFloor ? getFloorBounds(lastFloor) : bounds;
  const showRoof =
    plan.roof.visible !== false &&
    construction.showRoof &&
    options.showRoof &&
    (options.showAllFloors || options.floorId === lastFloor?.id);

  return (
    <group>
      {floors.map((floor) => (
        <FloorPlanModel
          key={floor.id}
          floor={floor}
          options={{
            ...options,
            // One label per room across a whole tower is thousands of DOM
            // nodes, so tall stacks only annotate the floor in focus.
            showRoomLabels:
              options.showRoomLabels &&
              (plan.floors.length <= LABELLED_FLOOR_MAX ||
                floor.id === options.floorId),
          }}
          showPlanDimensions={
            floor.elevation === 0 &&
            options.showDimensions &&
            construction.phase === "complete"
          }
        />
      ))}
      {construction.showOpenings && construction.showWalls ? (
        <FacadeGlazing floors={floors} wireframe={options.wireframe} />
      ) : null}
      {construction.showSlabs && options.showAllFloors
        ? plan.floors.map((floor) => (
            <FloorSlab
              key={`slab-${floor.id}`}
              elevation={floor.elevation}
              bounds={getFloorBounds(floor)}
              wireframe={options.wireframe}
            />
          ))
        : null}
      {showRoof && lastFloor ? (
        <StandingSeamRoof
          roof={plan.roof}
          minX={roofBounds.minX}
          maxX={roofBounds.maxX}
          minZ={roofBounds.minY}
          maxZ={roofBounds.maxY}
          wireframe={options.wireframe}
        />
      ) : null}
      {options.showDatums ? (
        <DatumLabels
          datums={plan.datums}
          origin={[bounds.minX - 1.6, 0, bounds.centerZ]}
        />
      ) : null}
    </group>
  );
}

interface FloorPlanModelProps {
  floor: Floor;
  options: Pick<
    ViewOptions,
    "showRoomLabels" | "showPipes" | "showElectrical" | "wireframe"
  >;
  showPlanDimensions: boolean;
}

export function FloorPlanModel({
  floor,
  options,
  showPlanDimensions,
}: FloorPlanModelProps) {
  const construction = useConstruction();
  const walls = construction.showWalls
    ? floor.walls.map((wall) => ({
        ...wall,
        height: Math.max(0.08, wall.height * construction.wallScale),
      }))
    : [];
  const openings = construction.showOpenings ? floor.openings : [];
  return (
    <group>
      {construction.showRooms
        ? buildRoomMeshes(floor, options.wireframe, options.showRoomLabels)
        : null}
      {buildWallMeshes({ ...floor, walls, openings }, options.wireframe)}
      {construction.showMep && options.showPipes
        ? buildPipeMeshes(floor, options.wireframe)
        : null}
      {construction.showMep && options.showElectrical
        ? buildElectricalMeshes(floor, options.wireframe)
        : null}
      {showPlanDimensions ? buildDimensionMeshes(floor) : null}
    </group>
  );
}

function FloorSlab({
  elevation,
  bounds,
  wireframe,
}: {
  elevation: number;
  bounds: ReturnType<typeof getPlanBounds>;
  wireframe: boolean;
}) {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxY - bounds.minY;
  return (
    <mesh
      position={[bounds.centerX, elevation - 0.08, bounds.centerZ]}
      receiveShadow
      castShadow
    >
      <boxGeometry args={[width, 0.16, depth]} />
      <meshStandardMaterial
        color="#c5bfb4"
        roughness={0.9}
        metalness={0}
        wireframe={wireframe}
      />
    </mesh>
  );
}

function buildRoomMeshes(
  floor: Floor,
  wireframe: boolean,
  showLabels: boolean,
) {
  return floor.rooms.map((room) => (
    <Room
      key={room.id}
      room={room}
      elevation={floor.elevation}
      wireframe={wireframe}
      showLabel={showLabels}
    />
  ));
}

function buildWallMeshes(floor: Floor, wireframe: boolean) {
  return floor.walls.map((wall) => {
    const openings = openingsForWall(wall.id, floor.openings);
    const segments = computeWallSegments(wall, openings);
    return (
      <WallMesh
        key={wall.id}
        wall={wall}
        segments={segments}
        openings={openings}
        elevation={floor.elevation}
        wireframe={wireframe}
      />
    );
  });
}

function buildPipeMeshes(floor: Floor, wireframe: boolean) {
  return floor.pipes.map((pipe) => (
    <UtilityRun
      key={pipe.id}
      kind="pipe"
      run={pipe}
      elevation={floor.elevation}
      wireframe={wireframe}
    />
  ));
}

function buildElectricalMeshes(floor: Floor, wireframe: boolean) {
  return floor.electrical.map((run) => (
    <UtilityRun
      key={run.id}
      kind="electrical"
      run={run}
      elevation={floor.elevation}
      wireframe={wireframe}
    />
  ));
}

function buildDimensionMeshes(floor: Floor) {
  return floor.dimensions.map((dimension) => (
    <DimensionLabel
      key={dimension.id}
      dimension={dimension}
      elevation={floor.elevation}
    />
  ));
}

function wallLength(wall: Wall): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

export function computeWallSegments(
  wall: Wall,
  openings: Opening[],
): WallSegment[] {
  const length = wallLength(wall);
  const alongWall = openings
    .filter((opening) => opening.wallId === wall.id)
    .map((opening) => ({
      start: Math.max(0, opening.offsetFromStart),
      end: Math.min(length, opening.offsetFromStart + opening.width),
      sill: Math.max(0, opening.sillHeight),
      header: Math.min(wall.height, opening.sillHeight + opening.height),
    }))
    .filter((opening) => opening.end - opening.start > 0.001)
    .sort((a, b) => a.start - b.start);

  const segments: WallSegment[] = [];
  let cursor = 0;

  for (const opening of alongWall) {
    if (opening.start - cursor > 0.001) {
      segments.push({
        startOffset: cursor,
        endOffset: opening.start,
        bottom: 0,
        top: wall.height,
      });
    }
    if (opening.sill > 0.001) {
      segments.push({
        startOffset: opening.start,
        endOffset: opening.end,
        bottom: 0,
        top: opening.sill,
      });
    }
    if (wall.height - opening.header > 0.001) {
      segments.push({
        startOffset: opening.start,
        endOffset: opening.end,
        bottom: opening.header,
        top: wall.height,
      });
    }
    cursor = Math.max(cursor, opening.end);
  }

  if (length - cursor > 0.001) {
    segments.push({
      startOffset: cursor,
      endOffset: length,
      bottom: 0,
      top: wall.height,
    });
  }

  return segments;
}

export function getFloorBounds(floor: Floor): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerZ: number;
} {
  return boundsFromWalls(floor.walls);
}

export function getPlanBounds(plan: FloorPlan) {
  const walls = plan.floors.flatMap((floor) => floor.walls);
  return boundsFromWalls(walls);
}

function boundsFromWalls(walls: Wall[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const wall of walls) {
    minX = Math.min(minX, wall.start.x, wall.end.x);
    maxX = Math.max(maxX, wall.start.x, wall.end.x);
    minY = Math.min(minY, wall.start.y, wall.end.y);
    maxY = Math.max(maxY, wall.start.y, wall.end.y);
  }

  if (!Number.isFinite(minX)) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, centerX: 0, centerZ: 0 };
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerZ: (minY + maxY) / 2,
  };
}

export function openingsForWall(wallId: string, openings: Opening[]): Opening[] {
  return openings.filter((opening) => opening.wallId === wallId);
}
