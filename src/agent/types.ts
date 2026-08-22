import type {
  ElectricalRun,
  FloorPlan,
  Opening,
  PipeRun,
  Roof,
  Room,
  Selection,
  SurfaceMaterial,
  Wall,
} from "../types/floorPlan";
import type { BuildingSpec } from "./buildingSpec";

export type AgentRole = "router" | "construct" | "edit" | "extract" | "explain";

export type AgentAction =
  | { type: "replace_plan"; plan: FloorPlan; note: string }
  | { type: "patch_roof"; patch: Partial<Roof> }
  | { type: "resize_room"; roomId: string; areaSqM: number; stack?: boolean }
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
  /** `label` is what the chat says was removed, when the id is unreadable. */
  | { type: "remove"; selection: Selection; label?: string }
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
  /** data:image/...;base64,... so the local VL can see the drawing. */
  dataUrl?: string;
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

export type PlannerKind = "local" | "llm" | "gis" | "intent";

export interface AgentTurn {
  agent: AgentRole;
  reply: string;
  actions: AgentAction[];
  planner: PlannerKind;
  model?: string;
  error?: string;
  /**
   * A proposed building awaiting the size and glazing choices. Present instead
   * of a `replace_plan` action, so nothing is committed until the questions in
   * `specOptions` have been answered.
   */
  draftSpec?: BuildingSpec;
  /** After an edit, one question the user can answer with a chip. */
  followUp?: FollowUp;
}

export interface FollowUp {
  prompt: string;
  options: FollowUpOption[];
}

export interface FollowUpOption {
  id: string;
  label: string;
  detail: string;
  recommended?: boolean;
  /** Sent back through the agent as the next user message. */
  prompt?: string;
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
