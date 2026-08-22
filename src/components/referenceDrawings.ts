import { useSyncExternalStore } from "react";
import type { ChatAttachment } from "../agent/types";

export interface ReferenceDrawing {
  id: string;
  name: string;
  dataUrl: string;
  at: number;
}

/** Enough to flick between the sheets of one drawing set without hoarding base64. */
const LIMIT = 6;

const STORAGE_KEY = "econ-reference-drawings";

// Kept across reloads: the sheet is uploaded once and compared against for the
// rest of the session, long after the chat turn that sent it.
let drawings: ReferenceDrawing[] = load();
const listeners = new Set<() => void>();

/**
 * The chat sends a drawing to the model and then drops the base64 so the
 * transcript stays light. Comparing the result against what was drawn needs
 * that image afterwards, so the images alone are kept here, newest first.
 */
export function rememberDrawings(attachments: ChatAttachment[] | undefined): void {
  const images = (attachments ?? []).filter((file) =>
    file.dataUrl?.startsWith("data:image/"),
  );
  if (images.length === 0) {
    return;
  }
  const at = Date.now();
  const added: ReferenceDrawing[] = images.map((file, index) => ({
    id: `ref-${at}-${index}`,
    name: file.name || `Drawing ${index + 1}`,
    dataUrl: file.dataUrl as string,
    at,
  }));
  // Re-uploading the same sheet should move it to the front, not sit twice.
  const kept = drawings.filter(
    (existing) => !added.some((entry) => entry.dataUrl === existing.dataUrl),
  );
  drawings = [...added, ...kept].slice(0, LIMIT);
  save();
  emit();
}

export function recentDrawings(): ReferenceDrawing[] {
  return drawings;
}

export function forgetDrawings(): void {
  if (drawings.length === 0) {
    return;
  }
  drawings = [];
  save();
  emit();
}

export function useReferenceDrawings(): ReferenceDrawing[] {
  return useSyncExternalStore(subscribe, recentDrawings, recentDrawings);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Absent under test and in the desktop main process, so never assumed. */
function storage(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

function load(): ReferenceDrawing[] {
  const store = storage();
  if (!store) {
    return [];
  }
  try {
    const raw = store.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? parsed.filter(isDrawing).slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

function save(): void {
  const store = storage();
  if (!store) {
    return;
  }
  // A scanned sheet is megabytes of base64 and the quota is a few. Rather than
  // lose the newest drawing, keep as many of the recent ones as will fit.
  for (let keep = drawings.length; keep > 0; keep -= 1) {
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(drawings.slice(0, keep)));
      return;
    } catch {
      continue;
    }
  }
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

function isDrawing(value: unknown): value is ReferenceDrawing {
  const entry = value as Partial<ReferenceDrawing> | null;
  return Boolean(
    entry &&
      typeof entry.id === "string" &&
      typeof entry.name === "string" &&
      typeof entry.dataUrl === "string" &&
      entry.dataUrl.startsWith("data:image/"),
  );
}
