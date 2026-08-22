import type {
  ElectricalRun,
  FloorPlan,
  Opening,
  PipeRun,
  Room,
  Selection,
  SurfaceMaterial,
  Wall,
} from "../types/floorPlan";

export type AgentRole = "router" | "construct" | "edit" | "extract" | "explain";

export type AgentAction =
  | { type: "replace_plan"; plan: FloorPlan; note: string }
  | { type: "patch_wall"; wallId: string; patch: Partial<Wall> }
  | { type: "patch_room"; roomId: string; patch: Partial<Room> }
  | { type: "patch_opening"; openingId: string; patch: Partial<Opening> }
  | { type: "patch_pipe"; pipeId: string; patch: Partial<PipeRun> }
  | { type: "patch_electrical"; runId: string; patch: Partial<ElectricalRun> }
  | { type: "add_wall"; floorId: string; wall: Wall }
  | { type: "add_room"; floorId: string; room: Room }
  | { type: "add_opening"; floorId: string; opening: Opening }
  | { type: "add_pipe"; floorId: string; pipe: PipeRun }
  | { type: "add_electrical"; floorId: string; run: ElectricalRun }
  | { type: "remove"; selection: Selection }
  | {
      type: "set_material";
      kind: "wall" | "room" | "pipe" | "electrical";
      match: string;
      material: SurfaceMaterial;
    };

export interface ChatAttachment {
  name: string;
  type: string;
  size: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  agent?: AgentRole;
  actions?: string[];
  attachments?: ChatAttachment[];
  planner?: PlannerKind;
  model?: string;
}

export type PlannerKind = "local" | "llm" | "gis";

export interface AgentTurn {
  agent: AgentRole;
  reply: string;
  actions: AgentAction[];
  planner: PlannerKind;
  model?: string;
  error?: string;
}

export interface BuildBrief {
  name?: string;
  width: number;
  depth: number;
  stories: number;
  storyHeight: number;
  rooms: string[];
  includeMep: boolean;
  project?: string;
  notes?: string;
}
