import { Edges, Html } from "@react-three/drei";
import type { Floor, FloorPlan, Opening, Wall } from "../types/floorPlan";
import {
  computeWallSegments,
  getFloorBounds,
  getPlanBounds,
  openingsForWall,
} from "./FloorPlanModel";
import { useConstruction } from "../editor/ConstructionContext";
import { FacadeGlazing } from "./FacadeGlazing";
import { StandingSeamRoof } from "./StandingSeamRoof";
import { UtilityRun } from "./UtilityRun";

const EDGE = "#7ee0d6";
const FILL = "#0d1418";
const INTERIOR = "#10181d";
const GLASS = "#5eead4";

interface ExperienceBuildingProps {
  plan: FloorPlan;
}

/** Floor tags are DOM nodes, so a tall stack is sampled down to a few marks. */
const MAX_FLOOR_TAGS = 8;

export function ExperienceBuilding({ plan }: ExperienceBuildingProps) {
  const construction = useConstruction();
  const bounds = getPlanBounds(plan);
  const lastFloor = plan.floors[plan.floors.length - 1];
  const roofBounds = lastFloor ? getFloorBounds(lastFloor) : bounds;
  const tagStep = Math.max(1, Math.ceil(plan.floors.length / MAX_FLOOR_TAGS));
  const taggedFloors = plan.floors.filter(
    (_, index) => index % tagStep === 0 || index === plan.floors.length - 1,
  );

  return (
    <group>
      {plan.floors.map((floor) => (
        <ExperienceFloor key={floor.id} floor={floor} />
      ))}
      {construction.showOpenings && construction.showWalls ? (
        <FacadeGlazing floors={plan.floors} wireframe={false} />
      ) : null}
      <mesh
        position={[bounds.centerX, -0.06, bounds.centerZ]}
        receiveShadow
      >
        <boxGeometry
          args={[
            bounds.maxX - bounds.minX + 0.6,
            0.12,
            bounds.maxY - bounds.minY + 0.6,
          ]}
        />
        <meshStandardMaterial color="#0a1014" roughness={0.9} metalness={0.2} />
        <Edges color={EDGE} threshold={20} />
      </mesh>
      {construction.showRoof ? (
        <StandingSeamRoof
          roof={{
            ...plan.roof,
          }}
          minX={roofBounds.minX}
          maxX={roofBounds.maxX}
          minZ={roofBounds.minY}
          maxZ={roofBounds.maxY}
          wireframe={false}
        />
      ) : null}
      {taggedFloors.map((floor) => (
        <Html
          key={`hotspot-${floor.id}`}
          position={[
            bounds.maxX + 1.1,
            floor.elevation + 1.4,
            bounds.centerZ,
          ]}
          center
          distanceFactor={18}
          style={{ pointerEvents: "none" }}
        >
          <div className="exp-hotspot">
            <span className="exp-hotspot-dot" />
            <span>{floor.name}</span>
            <em>{floor.elevation.toFixed(2)} m</em>
          </div>
        </Html>
      ))}
    </group>
  );
}

function ExperienceFloor({ floor }: { floor: Floor }) {
  const construction = useConstruction();
  const walls = construction.showWalls
    ? floor.walls.map((wall) => ({
        ...wall,
        height: Math.max(0.08, wall.height * construction.wallScale),
      }))
    : [];
  const visibleOpenings = construction.showOpenings ? floor.openings : [];
  return (
    <group>
      {walls.map((wall) => {
        const openings = openingsForWall(wall.id, visibleOpenings);
        const segments = computeWallSegments(wall, openings);
        return (
          <ExperienceWall
            key={wall.id}
            wall={wall}
            openings={openings}
            segments={segments}
            elevation={floor.elevation}
          />
        );
      })}
      {construction.showMep
        ? floor.pipes.map((pipe) => (
            <UtilityRun
              key={pipe.id}
              kind="pipe"
              run={pipe}
              elevation={floor.elevation}
              wireframe={false}
              presentation="experience"
            />
          ))
        : null}
      {construction.showMep
        ? floor.electrical.map((run) => (
            <UtilityRun
              key={run.id}
              kind="electrical"
              run={run}
              elevation={floor.elevation}
              wireframe={false}
              presentation="experience"
            />
          ))
        : null}
    </group>
  );
}

function ExperienceWall({
  wall,
  openings,
  segments,
  elevation,
}: {
  wall: Wall;
  openings: Opening[];
  segments: ReturnType<typeof computeWallSegments>;
  elevation: number;
}) {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.y - wall.start.y;
  const length = Math.hypot(dx, dz);
  const dirX = length === 0 ? 1 : dx / length;
  const dirZ = length === 0 ? 0 : dz / length;
  const rotationY = Math.atan2(-dz, dx);
  const isExterior = wall.type === "exterior";

  return (
    <group>
      {segments.map((segment, index) => {
        const segLength = segment.endOffset - segment.startOffset;
        const height = segment.top - segment.bottom;
        if (segLength < 0.001 || height < 0.001) {
          return null;
        }
        const mid = (segment.startOffset + segment.endOffset) / 2;
        return (
          <mesh
            key={`${wall.id}-${index}`}
            castShadow
            receiveShadow
            position={[
              wall.start.x + dirX * mid,
              elevation + (segment.bottom + segment.top) / 2,
              wall.start.y + dirZ * mid,
            ]}
            rotation={[0, rotationY, 0]}
          >
            <boxGeometry args={[segLength, height, wall.thickness]} />
            <meshStandardMaterial
              color={isExterior ? FILL : INTERIOR}
              roughness={0.55}
              metalness={0.35}
              transparent={!isExterior}
              opacity={isExterior ? 1 : 0.28}
              emissive={isExterior ? "#123038" : "#000000"}
              emissiveIntensity={isExterior ? 0.35 : 0}
            />
            {isExterior ? <Edges color={EDGE} threshold={15} /> : null}
          </mesh>
        );
      })}
      {openings.map((opening) => {
        const mid = opening.offsetFromStart + opening.width / 2;
        return (
          <mesh
            key={opening.id}
            position={[
              wall.start.x + dirX * mid,
              elevation + opening.sillHeight + opening.height / 2,
              wall.start.y + dirZ * mid,
            ]}
            rotation={[0, rotationY, 0]}
          >
            <boxGeometry
              args={[
                opening.width * 0.92,
                opening.height * 0.92,
                wall.thickness * 0.2,
              ]}
            />
            <meshStandardMaterial
              color={opening.type === "window" ? GLASS : "#2a1f1a"}
              emissive={opening.type === "window" ? GLASS : "#6b5344"}
              emissiveIntensity={opening.type === "window" ? 1.6 : 0.3}
              transparent
              opacity={opening.type === "window" ? 0.55 : 0.85}
              roughness={0.15}
              metalness={0.4}
            />
          </mesh>
        );
      })}
    </group>
  );
}
