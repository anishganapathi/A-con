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
  let bestId: string | null = null;
  let bestScore = 0;
  for (const floor of plan.floors) {
    for (const room of floor.rooms) {
      for (const alias of roomAliases(room.id, room.name)) {
        if (!utterance.includes(alias)) {
          continue;
        }
        if (alias.length > bestScore) {
          bestId = room.id;
          bestScore = alias.length;
        }
      }
    }
  }
  return bestId;
}

function roomAliases(id: string, name: string): string[] {
  const aliases = new Set<string>();
  aliases.add(id.toLowerCase());
  aliases.add(name.toLowerCase());
  aliases.add(name.toLowerCase().replace(/\s+room$/, ""));
  aliases.add(id.toLowerCase().replace(/-/g, " "));
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

function hasAny(utterance: string, phrases: string[]): boolean {
  return phrases.some((phrase) => utterance.includes(phrase));
}
