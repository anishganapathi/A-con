import type { FloorPlan, PipeRun, ElectricalRun, RoutePoint } from "../types/floorPlan";
import { findNamed } from "../editor/floorPlanEdits";
import type { AgentAction } from "./types";

const COLOR_NAMES: Record<string, string> = {
  warmer: "#d8c4a8",
  stone: "#d7cec0",
  white: "#f4f1ea",
  cream: "#efe6d6",
  gray: "#b9b6b0",
  grey: "#b9b6b0",
  black: "#2b2b2b",
  copper: "#b87333",
  blue: "#3d7ea6",
  yellow: "#f0c94d",
  amber: "#e39b1a",
};

export function planEdits(text: string, plan: FloorPlan): AgentAction[] {
  const actions: AgentAction[] = [];
  const lower = text.toLowerCase();

  const hex = text.match(/#([0-9a-f]{6})/i)?.[0];
  const namedColor = Object.keys(COLOR_NAMES).find((name) =>
    new RegExp(`\\b${name}\\b`, "i").test(text),
  );
  const color = hex ?? (namedColor ? COLOR_NAMES[namedColor] : undefined);

  if (/exterior/.test(lower) && (color || /paint|color|material/.test(lower))) {
    for (const floor of plan.floors) {
      for (const wall of floor.walls.filter((entry) => entry.type === "exterior")) {
        actions.push({
          type: "patch_wall",
          wallId: wall.id,
          patch: {
            material: {
              color: color ?? "#d8c4a8",
              roughness: 0.9,
              metalness: 0.02,
              opacity: 1,
            },
          },
        });
      }
    }
  }

  const thickness = text.match(
    /thick(?:en|ness)?(?:\s+\w+){0,4}\s*(?:to\s*)?(\d+(?:\.\d+)?)/i,
  );
  if (thickness && /wall/.test(lower)) {
    const value = Number(thickness[1]);
    const exteriorOnly = /exterior/.test(lower);
    for (const floor of plan.floors) {
      for (const wall of floor.walls) {
        if (exteriorOnly && wall.type !== "exterior") {
          continue;
        }
        actions.push({
          type: "patch_wall",
          wallId: wall.id,
          patch: { thickness: value },
        });
      }
    }
  }

  const wallHeight = text.match(
    /(?:wall|ceiling|story)\s*height(?:\s+\w+){0,3}\s*(?:to\s*)?(\d+(?:\.\d+)?)/i,
  );
  if (wallHeight) {
    const value = Number(wallHeight[1]);
    for (const floor of plan.floors) {
      for (const wall of floor.walls) {
        actions.push({
          type: "patch_wall",
          wallId: wall.id,
          patch: { height: value },
        });
      }
    }
  }

  const rename = text.match(/rename\s+(.+?)\s+to\s+["']?([^"'\n.]+)/i);
  if (rename?.[1] && rename[2]) {
    const found = findNamed(plan, rename[1]);
    if (found?.selection.kind === "room") {
      actions.push({
        type: "patch_room",
        roomId: found.selection.id,
        patch: { name: rename[2].trim() },
      });
    }
  }

  const resize = text.match(
    /(?:increase|enlarge|resize|expand|grow|set|make|decrease|reduce|shrink)\s+(?:the\s+)?(?:size\s+of\s+)?(?:the\s+)?(.+?)\s+(?:size|area)\s+to\s+(\d+(?:\.\d+)?)/i,
  );
  const fromTo = text.match(
    /(?:increase|enlarge|resize|expand|grow|set|make|decrease|reduce|shrink)\s+(?:the\s+)?(?:size\s+of\s+)?(?:the\s+)?(.+?)\s+from\s+\d+(?:\.\d+)?\s*m?\s*to\s+(\d+(?:\.\d+)?)/i,
  );
  const growMatch = resize ?? fromTo;
  if (growMatch?.[1] && growMatch[2]) {
    const found = findNamed(plan, growMatch[1].replace(/\s+(?:size|area)$/i, ""));
    if (found?.selection.kind === "room") {
      const keepOtherFloors =
        /keep(?:ing)?\s+(?:the\s+)?(?:remaining|other)\s+floors|only\s+(?:this|that)\s+floor|leave\s+(?:the\s+)?(?:other|remaining)\s+floors/i.test(
          text,
        );
      actions.push({
        type: "resize_room",
        roomId: found.selection.id,
        areaSqM: Number(growMatch[2]),
        ...(keepOtherFloors ? { stack: false } : {}),
      });
    }
  }

  if (/\broof\b/.test(lower) && /(?:remove|delete|hide|take\s+off|without)\b/.test(lower)) {
    actions.push({ type: "patch_roof", patch: { visible: false } });
  } else if (
    /\b(?:show|restore|unhide|put\s+back)\b.*\broof\b|\badd\s+(?:the\s+)?roof\b/.test(
      lower,
    )
  ) {
    actions.push({ type: "patch_roof", patch: { visible: true } });
  }

  const removeMatch = text.match(/(?:delete|remove)\s+(?:the\s+)?(.+)$/i);
  if (removeMatch?.[1] && !/^roof\b/i.test(removeMatch[1].trim())) {
    const found = findNamed(plan, removeMatch[1].replace(/[.!]+$/, ""));
    if (found) {
      actions.push({ type: "remove", selection: found.selection });
    }
  }

  const move = text.match(
    /move\s+(?:the\s+)?(.+?)\s+(\d+(?:\.\d+)?)\s*m?\s*(east|west|north|south)/i,
  );
  if (move?.[1] && move[2] && move[3]) {
    const found = findNamed(plan, move[1]);
    const distance = Number(move[2]);
    const dir = move[3].toLowerCase();
    const dx = dir === "east" ? distance : dir === "west" ? -distance : 0;
    const dy = dir === "north" ? distance : dir === "south" ? -distance : 0;
    if (found?.selection.kind === "pipe") {
      const pipe = plan.floors
        .flatMap((floor) => floor.pipes)
        .find((entry) => entry.id === found.selection.id);
      if (pipe) {
        actions.push({
          type: "patch_pipe",
          pipeId: pipe.id,
          patch: { points: shiftPoints(pipe.points, dx, dy) },
        });
      }
    }
    if (found?.selection.kind === "electrical") {
      const run = plan.floors
        .flatMap((floor) => floor.electrical)
        .find((entry) => entry.id === found.selection.id);
      if (run) {
        actions.push({
          type: "patch_electrical",
          runId: run.id,
          patch: { points: shiftPoints(run.points, dx, dy) },
        });
      }
    }
    if (found?.selection.kind === "wall") {
      const wall = plan.floors
        .flatMap((floor) => floor.walls)
        .find((entry) => entry.id === found.selection.id);
      if (wall) {
        actions.push({
          type: "patch_wall",
          wallId: wall.id,
          patch: {
            start: { x: wall.start.x + dx, y: wall.start.y + dy },
            end: { x: wall.end.x + dx, y: wall.end.y + dy },
          },
        });
      }
    }
  }

  const addPipe = text.match(
    /add(?:\s+a)?\s+(supply|waste|vent|gas)(?:\s+pipe)?(?:\s+(?:to|in|for)\s+the\s+(\w+))?/i,
  );
  if (addPipe?.[1]) {
    const floor = plan.floors[0];
    if (floor) {
      const target = addPipe[2];
      const room = target
        ? floor.rooms.find((entry) =>
            entry.name.toLowerCase().includes(target.toLowerCase()),
          )
        : floor.rooms[0];
      const to = room?.labelPosition ?? { x: 2, y: 3 };
      const stack =
        floor.pipes.find((pipe) => pipe.id.includes("stack"))?.points[0] ?? {
          x: to.x + 3,
          y: to.y,
          height: 0.3,
        };
      const system = addPipe[1].toLowerCase() as PipeRun["system"];
      const pipe: PipeRun = {
        id: `chat-${system}-${Date.now()}`,
        name: `${capitalize(system)} — ${room?.name ?? "new run"}`,
        system,
        diameter: system === "waste" ? 0.075 : 0.032,
        points: [
          { x: stack.x, y: stack.y, height: system === "waste" ? 0.22 : 2.4 },
          { x: to.x, y: to.y, height: system === "waste" ? 0.22 : 0.9 },
        ],
      };
      actions.push({ type: "add_pipe", floorId: floor.id, pipe });
    }
  }

  const addElec = text.match(
    /add(?:\s+a)?\s+(power|lighting|data)(?:\s+(?:circuit|run|wire|conduit))?/i,
  );
  if (addElec?.[1] && !/electrical riser/i.test(text)) {
    const floor = plan.floors[0];
    if (floor) {
      const circuit = addElec[1].toLowerCase() as ElectricalRun["circuit"];
      const riser = floor.electrical.find((run) => run.id.includes("riser"));
      const start = riser?.points[0] ?? { x: 4.5, y: 2.2, height: 2.4 };
      const run: ElectricalRun = {
        id: `chat-${circuit}-${Date.now()}`,
        name: `${capitalize(circuit)} circuit`,
        circuit,
        diameter: 0.02,
        points: [
          { x: start.x, y: start.y, height: circuit === "power" ? 0.4 : 2.4 },
          { x: start.x + 2.4, y: start.y + 1.8, height: circuit === "power" ? 0.4 : 2.4 },
        ],
      };
      actions.push({ type: "add_electrical", floorId: floor.id, run });
    }
  }

  if (color && /kitchen|living|bath|bedroom|room/.test(lower)) {
    const roomMatch = text.match(/(kitchen|living|bath|bedroom(?:\s*\d+)?|hallway|office)/i);
    if (roomMatch?.[1]) {
      const found = findNamed(plan, roomMatch[1]);
      if (found?.selection.kind === "room") {
        actions.push({
          type: "patch_room",
          roomId: found.selection.id,
          patch: {
            material: {
              color,
              roughness: 0.88,
              metalness: 0,
              opacity: 1,
            },
          },
        });
      }
    }
  }

  return actions;
}

function shiftPoints(points: RoutePoint[], dx: number, dy: number): RoutePoint[] {
  return points.map((point) => ({
    ...point,
    x: point.x + dx,
    y: point.y + dy,
  }));
}

function capitalize(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}
