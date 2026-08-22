import { app, BrowserWindow, shell } from "electron";
import { join } from "node:path";
import { loadDotEnv, mergeProcessEnv } from "./env.ts";
import { startLocalServer, type LocalServer } from "./localServer.ts";
import { runSmokeCheck } from "./smoke.ts";
import { windowChrome } from "./windowChrome.ts";

const RENDERER_ROOT = join(__dirname, "renderer");
/** dist/main.cjs sits two levels under the repo, where the dev `.env` lives. */
const REPO_ROOT = join(__dirname, "..", "..");

let server: LocalServer | null = null;

app.setName("Acon");

// A second launch focuses the open window instead of starting a rival server.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [existing] = BrowserWindow.getAllWindows();
    if (existing) {
      if (existing.isMinimized()) {
        existing.restore();
      }
      existing.focus();
    }
  });
  void start();
}

async function start() {
  await app.whenReady();

  const url = await hostRenderer();
  await openWindow(url);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void openWindow(url);
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  void server?.close();
  server = null;
});

/**
 * In development Vite serves the renderer and mounts the agent API itself, so
 * the app points at it and keeps hot reload. Packaged, there is no Vite: the
 * built renderer and the same API handlers are served over loopback so the
 * app's relative `/api/...` calls resolve exactly as they do on the web.
 */
async function hostRenderer(): Promise<string> {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) {
    return devUrl;
  }
  server = await startLocalServer({ root: RENDERER_ROOT, env: readEnv() });
  return server.url;
}

/**
 * Provider keys come from the same `.env` the dev server reads. Once packaged
 * there is no repo to read, so the app's own data directory is the place to put
 * one, and it outranks anything shipped inside the bundle.
 */
function appIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, "logo.png")
    : join(REPO_ROOT, "public", "logo.png");
}

function readEnv(): Record<string, string> {
  const dirs = app.isPackaged
    ? [process.resourcesPath, app.getPath("userData")]
    : [REPO_ROOT];
  const env: Record<string, string> = {};
  for (const dir of dirs) {
    Object.assign(env, loadDotEnv(dir, app.isPackaged ? "production" : "development"));
  }
  return mergeProcessEnv(env);
}

async function openWindow(url: string): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    // Matches the app's page background so launch does not flash white.
    backgroundColor: "#dfe6ee",
    title: "Acon",
    icon: appIconPath(),
    show: false,
    ...windowChrome(process.platform),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // The renderer is the unmodified web app: it needs no bridge, so none is
      // exposed and there is no preload surface to attack.
      webgl: true,
    },
  });

  window.once("ready-to-show", () => window.show());
  harden(window);

  if (process.env.ACON_SMOKE) {
    runSmokeCheck(window);
  }

  await window.loadURL(url);
  return window;
}

function harden(window: BrowserWindow) {
  // Anything that is not the app itself belongs in the user's browser, not in a
  // chrome-less Electron window.
  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, target) => {
    if (new URL(target).origin !== new URL(window.webContents.getURL()).origin) {
      event.preventDefault();
      void shell.openExternal(target);
    }
  });

  window.webContents.on("will-attach-webview", (event) => event.preventDefault());

  // The app asks for no camera, microphone, or location; refuse on its behalf.
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, grant) =>
    grant(false),
  );
}
