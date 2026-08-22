import { editActionsOnly, imageDataUrls, type VisionRequest } from "./localLlm.ts";

export const MASTER_TOOLS = [
  {
    type: "function",
    function: {
      name: "match_elevation",
      description:
        "Make the live building's front (or named) elevation similar to a drawing. Use this when the user says the elevation should be similar, match, or look like the sheet. Do not rebuild. Measure the drawing and fill elevation — do not copy the live roof numbers if the drawing looks different.",
      parameters: {
        type: "object",
        properties: {
          reply: { type: "string" },
          face: { type: "string", enum: ["front", "south", "north"] },
          eaveHeight: { type: "number" },
          ridgeHeight: { type: "number" },
          windowWidth: { type: "number" },
          windowHeight: { type: "number" },
          sillHeight: { type: "number" },
          windowsPerFloor: {
            description: "Window count per storey from the ground up, or one number for every floor.",
          },
          doorWidth: { type: "number" },
        },
        required: ["reply"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_live_model",
      description:
        "Change the building that is already on screen. Use this when the user wants the live model edited, including making it similar to a drawing, changing a room, the roof, walls, or openings. Never replace the whole plan.",
      parameters: {
        type: "object",
        properties: {
          reply: { type: "string", description: "What you saw and what you are changing." },
          actions: {
            type: "array",
            items: { type: "object" },
            description:
              "Live patches: patch_roof, resize_room, patch_wall, patch_room, patch_opening, patch_pipe, patch_electrical, set_material. Put the fields in a flat \"patch\" object, never inside \"properties\". A window or door moves along its wall, so to slide or re-space one use patch_opening with offsetFromStart, and use width, height or sillHeight to resize it — all in metres, e.g. {\"type\":\"patch_opening\",\"openingId\":\"l3-win-n2\",\"patch\":{\"offsetFromStart\":6.5}}. The summary gives each wall's length; keep offsetFromStart + width inside it. IDs must exist on the live plan (living, l2-living, l3-living, ext-south, …). To add a service that does not exist yet, use add_electrical or add_pipe with the room instead of an id, e.g. {\"type\":\"add_electrical\",\"room\":\"l3-living\",\"circuit\":\"power\"} — the server routes it through that room. To delete something, use remove with the id from the summary, e.g. {\"type\":\"remove\",\"selection\":{\"kind\":\"pipe\",\"id\":\"l2-pipe-added-1\"}} — kind is wall, room, opening, pipe, or electrical. Never express a deletion as a patch.",
          },
        },
        required: ["reply", "actions"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_building",
      description:
        "Author a new building from the prompt and any drawings. Use only when the user asked to build, rebuild, or replace the model — not when they asked to make the current one similar.",
      parameters: {
        type: "object",
        properties: {
          reply: { type: "string" },
          spec: {
            type: "object",
            description: "typology, width, depth, stories, storyHeight, roof, notes, footprint",
          },
        },
        required: ["reply", "spec"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_drawing",
      description: "Describe a drawing without changing the live model.",
      parameters: {
        type: "object",
        properties: { reply: { type: "string" } },
        required: ["reply"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "explain",
      description: "Answer a question about the live model. No edits.",
      parameters: {
        type: "object",
        properties: { reply: { type: "string" } },
        required: ["reply"],
      },
    },
  },
] as const;

export const MASTER_PROMPT = `You are Acon's master intent. Read the user prompt, any drawings, and the live FloorPlan.
Choose exactly one tool. The prompt decides the tool — not the file type.

- "make the elevation similar" / "front elevation" / "match this" / "look like this" → match_elevation. Measure the drawing. Copy IDs is unnecessary — give window sizes, counts, and roof heights that match what you see.
- "rebuild" / "build from this plan" / "replace the model" → propose_building.
  Count the floor plans on the sheet (Ground + First = 2). Never copy the live model's 3 storeys.
  Width and depth in metres (25' × 40' = 7.6 × 12.2 m).
  Put those rooms in spec.levels, never in footprint. Stop after the last sheet (Ground + First). Do not invent L2–L12 or copy the live roof 10.15 / 11.9. Reply in two sentences, not JSON.
- "what do you see" with a drawing → read_drawing.
- a question with no change → explain.
- a greeting or small talk — "hi", "hello", "thanks", "who are you", "what can you do" → explain, answering in one or two friendly sentences. Say hello back and offer what you can do. Do not rebuild, and do not recite the model's dimensions unless you were asked for them.

- "add a cable / socket / circuit / extra pipe in <room>" → edit_live_model with add_electrical or add_pipe naming that room. Never patch a run id that is not in the summary.
  e.g. {"reply":"Adding a power circuit to the L3 living room.","actions":[{"type":"add_electrical","room":"l3-living","circuit":"power"}]}
- "remove / delete / take out the X" → edit_live_model with a remove action for the id in the summary. Removing is never an add.
  e.g. {"reply":"Removing the balcony supply pipe.","actions":[{"type":"remove","selection":{"kind":"pipe","id":"l2-pipe-added-1"}}]}

edit_live_model must always carry actions. An empty list changes nothing, so if you meant to change something, put it in actions.

If you edit rooms, use real IDs from the plan summary. Ground-floor living is "living".
You cannot add extra gables or chimneys. match_elevation still restages the front windows and the single gable.

If the server does not execute tools, reply with JSON:
{"tool":"propose_building","arguments":{"reply":"…","spec":{"width":7.6,"depth":12.2,"stories":2,"storyHeight":3,"levels":[{"name":"Ground Floor","zones":[{"name":"Parking","x":4.6,"y":0,"w":3.0,"h":5.1,"kind":"entry"}]},{"name":"First Floor","zones":[{"name":"Kitchen","x":4.3,"y":7.6,"w":2.4,"h":3.0,"kind":"wet"}]}]}}}`;


export interface MasterCall {
  tool: "match_elevation" | "edit_live_model" | "propose_building" | "read_drawing" | "explain";
  arguments: Record<string, unknown>;
}

export function parseMasterCall(content: unknown, extra?: { tool_calls?: unknown }): MasterCall {
  const fromTools = readOpenAiToolCalls(extra?.tool_calls);
  if (fromTools) {
    return fromTools;
  }
  const text = messageText(content);
  const parsed = parseJsonObject(text);
  const args = asArgumentRecord(parsed.arguments);
  // Written out as text rather than sent down the tool channel, which the local
  // VL does routinely — and when it does, it reaches for OpenAI's own
  // {"name","arguments"} shape as readily as the {"tool",...} one asked for.
  const named =
    typeof parsed.tool === "string"
      ? parsed.tool
      : typeof parsed.name === "string"
        ? parsed.name
        : null;
  if (named && args) {
    return normalizeCall(named, { ...args, reply: cleanReply(args.reply) ?? args.reply });
  }
  const spec = extractBuildingSpec(parsed) ?? extractBuildingSpec(text);
  if (spec) {
    return normalizeCall("propose_building", {
      reply: cleanReply(parsed.reply) ?? cleanReply(text) ?? "Rebuilding from the drawing.",
      spec,
    });
  }
  if (
    parsed.elevation ||
    parsed.ridgeHeight !== undefined ||
    parsed.windowWidth !== undefined ||
    parsed.windowsPerFloor !== undefined
  ) {
    return normalizeCall("match_elevation", parsed);
  }
  if (Array.isArray(parsed.actions) && (parsed.actions as unknown[]).length > 0) {
    return normalizeCall("edit_live_model", parsed);
  }
  if (parsed.agent === "edit" || parsed.agent === "explain") {
    return normalizeCall(parsed.agent === "explain" ? "explain" : "read_drawing", parsed);
  }
  return { tool: "explain", arguments: { reply: text.trim() || "I could not choose a tool." } };
}

export function applyMasterCall(
  call: MasterCall,
  request: VisionRequest,
): Record<string, unknown> {
  const reply = String(call.arguments?.reply ?? "");
  if (call.tool === "propose_building") {
    if (request.locked) {
      return {
        agent: "edit",
        reply: `${reply}\n\nThe workspace is locked, so I will not replace the model. Unlock to rebuild, or ask me to make the live building similar instead.`,
        actions: [],
      };
    }
    const spec = {
      ...((extractBuildingSpec(call.arguments) ??
        call.arguments.spec ??
        call.arguments) as Record<string, unknown>),
    };
    delete spec.reply;
    delete spec.tool;
    if (imageDataUrls(request.attachments).length > 0) {
      spec.measured = true;
    }
    return {
      agent: "construct",
      reply: cleanReply(reply) ?? "Rebuilding from the drawing.",
      spec,
      actions: [],
    };
  }
  if (call.tool === "match_elevation") {
    const { reply: _reply, actions: _actions, ...elevation } = call.arguments;
    return {
      agent: "edit",
      reply,
      actions: editActionsOnly(call.arguments.actions),
      elevation,
    };
  }
  if (call.tool === "edit_live_model") {
    return {
      agent: "edit",
      reply,
      actions: editActionsOnly(call.arguments.actions),
      elevation: call.arguments.elevation ?? undefined,
    };
  }
  return {
    agent: call.tool === "read_drawing" ? "edit" : "explain",
    reply,
    actions: [],
  };
}

export function extractBuildingSpec(payload: unknown): Record<string, unknown> | null {
  if (typeof payload === "string") {
    const parsed = parseJsonObject(payload);
    return (
      extractBuildingSpec(parsed) ??
      extractSpecFromText(payload)
    );
  }
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (record.spec && typeof record.spec === "object") {
    return extractBuildingSpec(record.spec);
  }
  if (
    typeof record.width === "number" ||
    Array.isArray(record.levels) ||
    isProgramList(record.footprint)
  ) {
    return record;
  }
  if (typeof record.reply === "string" && record.reply.includes("spec")) {
    return extractBuildingSpec(record.reply);
  }
  return null;
}

export function cleanReply(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("{")) {
    return trimmed || null;
  }
  const parsed = parseJsonObject(trimmed);
  if (typeof parsed.reply === "string" && !parsed.reply.trim().startsWith("{")) {
    return parsed.reply.trim();
  }
  // The sentence is often one level down, inside the arguments of a call the
  // model wrote out as text.
  const nested = asArgumentRecord(parsed.arguments);
  if (typeof nested?.reply === "string" && !nested.reply.trim().startsWith("{")) {
    return nested.reply.trim();
  }
  return null;
}

function extractSpecFromText(text: string): Record<string, unknown> | null {
  const width = text.match(/"width"\s*:\s*([0-9.]+)/);
  const depth = text.match(/"depth"\s*:\s*([0-9.]+)/);
  const stories = text.match(/"stories"\s*:\s*([0-9.]+)/);
  const floors = takeNamedFloors(text);
  if (!width && floors.length === 0) {
    return null;
  }
  return {
    typology: "residential",
    width: width ? Number(width[1]) : undefined,
    depth: depth ? Number(depth[1]) : undefined,
    stories: floors.length || (stories ? Number(stories[1]) : 2),
    levels: floors.length > 0 ? floors : undefined,
    footprint: floors.length > 0 ? floors : undefined,
  };
}

function takeNamedFloors(text: string): Record<string, unknown>[] {
  const floors: Record<string, unknown>[] = [];
  for (const name of ["Ground Floor", "First Floor"]) {
    const needle = `"name": "${name}"`;
    const at = text.indexOf(needle);
    if (at < 0) {
      continue;
    }
    const start = text.lastIndexOf("{", at);
    const object = balancedObject(text.slice(start));
    if (!object) {
      continue;
    }
    try {
      floors.push(JSON.parse(object) as Record<string, unknown>);
    } catch {
      /* skip a broken floor */
    }
  }
  return floors;
}

function balancedObject(text: string): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (char === "\\") {
        escape = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(0, index + 1);
      }
    }
  }
  return null;
}

function isProgramList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.some(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        Array.isArray((entry as { zones?: unknown }).zones),
    )
  );
}

function normalizeCall(name: string, args: Record<string, unknown>): MasterCall {
  if (name === "propose_building" || name === "construct") {
    return { tool: "propose_building", arguments: args };
  }
  if (name === "match_elevation") {
    return { tool: "match_elevation", arguments: args };
  }
  if (name === "edit_live_model" || name === "edit") {
    return { tool: "edit_live_model", arguments: args };
  }
  if (name === "read_drawing") {
    return { tool: "read_drawing", arguments: args };
  }
  return { tool: "explain", arguments: args };
}

function readOpenAiToolCalls(toolCalls: unknown): MasterCall | null {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return null;
  }
  const first = toolCalls[0] as {
    function?: { name?: string; arguments?: unknown };
    name?: string;
    arguments?: unknown;
  };
  const name = first.function?.name ?? first.name;
  if (!name) {
    return null;
  }
  const args =
    asArgumentRecord(first.function?.arguments ?? first.arguments) ?? {};
  return normalizeCall(name, args);
}

function asArgumentRecord(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    const parsed = parseJsonObject(value);
    return Object.keys(parsed).length > 0 ? parsed : { reply: value };
  }
  return null;
}

export function messageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: unknown }).text ?? "");
        }
        return "";
      })
      .join("");
  }
  return "";
}

function parseJsonObject(content: string): Record<string, unknown> {
  const trimmed = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced?.[1] ?? trimmed;
  const object = raw.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(object?.[0] ?? raw) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* fall through */
  }
  return {};
}
