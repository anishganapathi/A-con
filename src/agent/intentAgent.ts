import type { FloorPlan } from "../types/floorPlan";
import type { AgentAction, ChatAttachment } from "./types";

export type UserIntent =
  | {
      role: "edit";
      kind: "resize_room";
      roomId: string;
      areaSqM: number;
      stack: boolean;
    }
  | { role: "edit"; kind: "hide_roof" }
  | { role: "edit"; kind: "show_roof" }
  | { role: "edit"; kind: "keep_roof" }
  | { role: "edit"; kind: "read_drawing" }
  | { role: "edit"; kind: "freeform"; text: string }
  | { role: "construct"; kind: "construct" }
  | { role: "extract"; kind: "extract" }
  | { role: "explain"; kind: "explain" };

const GROW = ["increase", "enlarge", "expand", "grow", "widen", "raise", "bigger", "larger"];
const SHRINK = ["decrease", "reduce", "shrink", "smaller", "shorten", "lower"];
const CONSTRUCT = [
  "build",
  "construct",
  "create",
  "generate",
  "new house",
  "new building",
  "house",
  "apartment",
];
const EXTRACT = ["extract", "upload", "drawing", "sheet", "pdf", "scan"];
const ROOF = ["roof"];
const HIDE = ["remove", "removing", "delete", "deleting", "hide", "hiding", "take off", "without"];
const SHOW = ["show", "restore", "put back", "unhide", "add", "adding"];
const KEEP = ["keep", "keeping", "leave", "leaving"];
const KEEP_FLOORS = [
  "remaining floors",
  "other floors",
  "other floor",
  "rest of the floors",
  "only this floor",
  "only that floor",
  "that floor only",
  "this floor only",
];

/**
 * Intent agent: classify the utterance against the live rooms, then fill slots.
 * It looks up names in the FloorPlan instead of hoping one regex matches the
 * whole sentence.
 */
export function interpretIntent(
  text: string,
  plan?: FloorPlan,
  attachments?: ChatAttachment[],
): UserIntent {
  const utterance = text.toLowerCase();
  if (hasDrawing(attachments)) {
    return { role: "edit", kind: "read_drawing" };
  }
  if (attachments && attachments.length > 0) {
    return { role: "extract", kind: "extract" };
  }

  const room = plan ? mentionRoom(utterance, plan) : null;
  const area = mentionArea(utterance);
  const keepFloors = KEEP_FLOORS.some((phrase) => utterance.includes(phrase));
  const wantsResize = Boolean(room && area !== null);

  if (wantsResize && room && area !== null) {
    return {
      role: "edit",
      kind: "resize_room",
      roomId: room,
      areaSqM: area,
      stack: !keepFloors,
    };
  }

  if (hasAny(utterance, ROOF) && hasAny(utterance, HIDE)) {
    return { role: "edit", kind: "hide_roof" };
  }
  if (hasAny(utterance, ROOF) && hasAny(utterance, KEEP)) {
    return { role: "edit", kind: "keep_roof" };
  }
  if (hasAny(utterance, ROOF) && hasAny(utterance, SHOW)) {
    return { role: "edit", kind: "show_roof" };
  }
  if (hasAny(utterance, ROOF)) {
    return { role: "edit", kind: "freeform", text };
  }

  if (hasAny(utterance, EXTRACT) && !wantsResize) {
    return { role: "extract", kind: "extract" };
  }
  if (hasAny(utterance, CONSTRUCT) && !room) {
    return { role: "construct", kind: "construct" };
  }
  if (
    room ||
    hasAny(utterance, [
      ...GROW,
      ...SHRINK,
      "add",
      "move",
      "paint",
      "color",
      "thicken",
      "rename",
      "set ",
    ])
  ) {
    return { role: "edit", kind: "freeform", text };
  }
  return { role: "explain", kind: "explain" };
}

export function actionsFromIntent(intent: UserIntent): AgentAction[] {
  if (intent.kind === "resize_room") {
    return [
      {
        type: "resize_room",
        roomId: intent.roomId,
        areaSqM: intent.areaSqM,
        stack: intent.stack,
      },
    ];
  }
  if (intent.kind === "hide_roof") {
    return [{ type: "patch_roof", patch: { visible: false } }];
  }
  if (intent.kind === "show_roof") {
    return [{ type: "patch_roof", patch: { visible: true } }];
  }
  return [];
}

function mentionRoom(utterance: string, plan: FloorPlan): string | null {
  const floorHint = mentionFloor(utterance, plan);
  const areaHint = mentionFromArea(utterance);
  const candidates: {
    id: string;
    aliasScore: number;
    areaDiff: number;
  }[] = [];

  for (const floor of plan.floors) {
    if (floorHint && floor.id !== floorHint) {
      continue;
    }
    for (const room of floor.rooms) {
      let aliasScore = 0;
      for (const alias of roomAliases(room.id, room.name, floor.name)) {
        if (utterance.includes(alias) && alias.length > aliasScore) {
          aliasScore = alias.length;
        }
      }
      if (aliasScore === 0) {
        continue;
      }
      const area = room.areaSqM ?? 0;
      candidates.push({
        id: room.id,
        aliasScore,
        areaDiff: areaHint === null ? 0 : Math.abs(area - areaHint),
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((left, right) => {
    if (areaHint !== null && left.areaDiff !== right.areaDiff) {
      return left.areaDiff - right.areaDiff;
    }
    return right.aliasScore - left.aliasScore;
  });
  return candidates[0]?.id ?? null;
}

function mentionFloor(utterance: string, plan: FloorPlan): string | null {
  const lMatch = utterance.match(/\bl\s*(\d+)\b/);
  if (lMatch?.[1]) {
    const id = `l${lMatch[1]}`;
    return plan.floors.find((floor) => floor.id === id)?.id ?? null;
  }
  if (/\b(?:ground|level\s*1|ff\.?\s*level\s*1)\b/.test(utterance)) {
    return plan.floors[0]?.id ?? null;
  }
  if (/\b(?:first\s+floor|ff\.?\s*first\s+floor)\b/.test(utterance)) {
    return (
      plan.floors.find((floor) => /first/i.test(floor.name))?.id ??
      plan.floors[1]?.id ??
      plan.floors[0]?.id ??
      null
    );
  }
  if (/\b(?:second\s+floor|ff\.?\s*second\s+floor)\b/.test(utterance)) {
    return plan.floors.find((floor) => /second/i.test(floor.name))?.id ?? plan.floors[1]?.id ?? null;
  }
  if (/\b(?:third\s+floor|ff\.?\s*third\s+floor)\b/.test(utterance)) {
    return plan.floors.find((floor) => /third/i.test(floor.name))?.id ?? plan.floors[2]?.id ?? null;
  }
  return null;
}

function mentionFromArea(utterance: string): number | null {
  const from = utterance.match(/\bfrom\s+(\d+(?:\.\d+)?)/);
  return from?.[1] ? Number(from[1]) : null;
}

function roomAliases(id: string, name: string, floorName = ""): string[] {
  const aliases = new Set<string>();
  aliases.add(id.toLowerCase());
  aliases.add(name.toLowerCase());
  aliases.add(name.toLowerCase().replace(/\s+room$/, ""));
  aliases.add(id.toLowerCase().replace(/-/g, " "));
  const core = name.replace(/^(L\d+\s+|\w+\s+Floor\s+)/i, "").trim();
  if (core) {
    aliases.add(core.toLowerCase());
    aliases.add(core.toLowerCase().replace(/\s+room$/, ""));
  }
  if (floorName) {
    aliases.add(`${floorName} ${name}`.toLowerCase());
    aliases.add(`${floorName} ${name}`.toLowerCase().replace(/\s+room$/, ""));
  }
  return [...aliases].filter((alias) => alias.length >= 3);
}

function mentionArea(utterance: string): number | null {
  const afterTo = utterance.match(/\bto\s+(\d+(?:\.\d+)?)/);
  if (afterTo?.[1]) {
    return Number(afterTo[1]);
  }
  const measured = utterance.match(/(\d+(?:\.\d+)?)\s*(m²|m2|sq\.?\s*m|sqm|m)\b/);
  if (measured?.[1]) {
    return Number(measured[1]);
  }
  const numbers = [...utterance.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
  return numbers.at(-1) ?? null;
}

function hasDrawing(attachments?: ChatAttachment[]): boolean {
  return Boolean(
    attachments?.some(
      (file) => file.dataUrl?.startsWith("data:image/") || file.type.startsWith("image/"),
    ),
  );
}

function hasAny(utterance: string, phrases: string[]): boolean {
  return phrases.some((phrase) => utterance.includes(phrase));
}
