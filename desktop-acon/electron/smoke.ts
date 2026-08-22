import { writeFile } from "node:fs/promises";
import { app, type BrowserWindow } from "electron";

const PROBE = `(async () => {
  const canvas = document.querySelector("canvas");
  const gl = canvas && (canvas.getContext("webgl2") || canvas.getContext("webgl"));
  // The agent API is the one thing the desktop host provides itself, so the
  // status endpoint is called the same way the chat panel calls it.
  let status = null;
  try {
    const response = await fetch("/api/agent");
    status = response.status;
  } catch (error) {
    status = String(error);
  }
  return {
    root: Boolean(document.querySelector("#root")?.childElementCount),
    canvas: Boolean(canvas),
    webgl: Boolean(gl),
    renderer: gl ? gl.getParameter(gl.VERSION) : null,
    chat: Boolean(document.querySelector(".chat-panel")),
    controls: Boolean(document.querySelector(".left-rail")),
    finishes: document.querySelectorAll(".finish-swatch").length,
    api: status,
    title: document.title,
  };
})()`;

/**
 * Launches, waits for the app to mount, and reports whether the renderer really
 * came up — used by `npm run smoke` so a packaged build can be checked without
 * a person watching the window.
 */
export function runSmokeCheck(window: BrowserWindow) {
  const problems: string[] = [];
  const notes: string[] = [];

  window.webContents.on("console-message", (...args: unknown[]) => {
    const detail = consoleDetail(args);
    if (!detail) {
      return;
    }
    // Warnings are noted, not failed on: three.js logs deprecations that the
    // web build logs too, and the desktop shell should not be held to a
    // stricter bar than the app it is hosting.
    (detail.level === "error" ? problems : notes).push(`console ${detail.text}`);
  });
  window.webContents.on("did-fail-load", (_event, code, description, url) => {
    problems.push(`did-fail-load ${code} ${description} ${url}`);
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    problems.push(`render-process-gone ${details.reason}`);
  });

  window.webContents.once("did-finish-load", () => {
    // React mounts and the first WebGL frame lands a tick after load.
    setTimeout(() => void report(window, problems, notes), 2500);
  });
}

async function report(window: BrowserWindow, problems: string[], notes: string[]) {
  try {
    const probe = (await window.webContents.executeJavaScript(PROBE)) as Record<
      string,
      unknown
    >;
    for (const [key, label] of [
      ["root", "React did not mount"],
      ["canvas", "no canvas in the document"],
      ["webgl", "no WebGL context"],
      ["chat", "chat panel missing"],
      ["controls", "view controls missing"],
      ["finishes", "material finish swatches missing"],
    ] as const) {
      if (!probe[key]) {
        problems.push(label);
      }
    }
    // 200 with a provider configured, 204 without one — both mean the endpoint
    // is being served. Anything else means the API is not wired up.
    if (probe.api !== 200 && probe.api !== 204) {
      problems.push(`GET /api/agent answered ${String(probe.api)}`);
    }
    console.log(`smoke: ${JSON.stringify(probe)}`);
  } catch (error) {
    problems.push(`probe failed: ${error instanceof Error ? error.message : "unknown"}`);
  }

  for (const note of notes) {
    console.log(`smoke: note · ${note}`);
  }
  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`smoke: ${problem}`);
    }
    console.error(`smoke: FAILED with ${problems.length} problem(s)`);
    app.exit(1);
    return;
  }
  await capture(window);
  console.log("smoke: OK");
  app.exit(0);
}

/**
 * Optional frame grab (ACON_SMOKE_SHOT=<path>) so a headless run can be looked
 * at afterwards. The probe proves the panels exist; only a picture shows layout.
 */
async function capture(window: BrowserWindow) {
  const target = process.env.ACON_SMOKE_SHOT;
  if (!target) {
    return;
  }
  const image = await window.webContents.capturePage();
  await writeFile(target, image.toPNG());
  console.log(`smoke: wrote ${target}`);
}

/**
 * Electron changed this event's shape: older versions pass positional
 * (level, message, line, source), newer ones a single details object. Only
 * errors and warnings are worth reporting either way.
 */
function consoleDetail(args: unknown[]): { level: "error" | "warning"; text: string } | null {
  const [first] = args;
  const [level, message] =
    first && typeof first === "object" && "level" in first
      ? [
          (first as { level?: string | number }).level,
          (first as { message?: string }).message ?? "",
        ]
      : [(args as [unknown, string | number, string])[1], (args as [unknown, unknown, string])[2]];

  const named = severity(level);
  return named ? { level: named, text: `${named}: ${message}` } : null;
}

function severity(level: string | number | undefined): "error" | "warning" | null {
  if (level === "error" || level === 3) {
    return "error";
  }
  if (level === "warning" || level === "warn" || level === 2) {
    return "warning";
  }
  return null;
}
