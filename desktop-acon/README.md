# desktop-acon

Acon as a desktop application, built with Electron.

This project holds **no copy of the app**. It builds `../src` with `../vite.config.ts`
and serves `../server`'s agent API, so the desktop build and the web build cannot
drift apart. The only things here are the Electron shell and the host that stands
in for the Vite dev server once the app is packaged.

## Running it

```bash
cd desktop-acon
npm install
npm run dev
```

`npm run dev` starts the same Vite dev server the web app uses — agent API
middleware and hot reload included — and points an Electron window at it. Editing
anything under `../src` reloads the window exactly as it reloads a browser tab.

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server + Electron window, with hot reload |
| `npm run build` | Builds the renderer into `dist/renderer` and the main process into `dist/main.cjs` |
| `npm start` | Builds, then runs the app the way a packaged build runs |
| `npm run smoke` | Builds and launches headlessly, checking the app really mounted (see below) |
| `npm run package` | Builds and produces an installer in `release/` |
| `npm run package:dir` | Builds an unpacked app in `release/`, skipping the installer |

## How the agent API is served

On the web, `/api/agent` and `/api/gis` are Vite dev-server middleware, which a
packaged app does not have. Rather than reimplement them, the handlers live in
`../server/agentApi.ts` and both hosts mount the same functions:

- **Development** — Vite serves the renderer and the API, as it always did.
- **Packaged** — `electron/localServer.ts` serves the built renderer *and* those
  same handlers over `http://127.0.0.1:<random port>`.

Serving over HTTP rather than `file://` is deliberate: the app's own
`fetch("/api/agent")` calls then resolve with no change to the app's code.

## Provider keys

Keys are read from the same `.env` the dev server reads.

- **Development** — `../.env` in the repo, exactly as `npm run dev` does upstairs.
- **Packaged** — `.env` in the app's data directory, which outranks anything
  shipped inside the bundle:
  - macOS `~/Library/Application Support/Acon/.env`
  - Windows `%APPDATA%\Acon\.env`
  - Linux `~/.config/Acon/.env`

Precedence matches Vite: `.env` < `.env.local` < `.env.<mode>` < `.env.<mode>.local`,
and a real environment variable beats all of them. Without any key the app falls
back to local rules, the same as the web build.

## The smoke check

`npm run smoke` launches the built app, waits for it to mount, and exits non-zero
if the renderer did not come up. It asserts React mounted, a WebGL context exists,
the chat panel and view controls rendered, and `GET /api/agent` answered. three.js
deprecation warnings are reported as notes, not failures, because the web build
logs them too.

```
smoke: {"root":true,"canvas":true,"webgl":true,"renderer":"WebGL 2.0 …","chat":true,"controls":true,"api":200}
smoke: OK
```

## Notes

- Unit tests for the pieces added here (`.env` parsing, static path resolution,
  launch environment) run with the repo's suite: `npm test` from the parent.
- The window is hardened: no node integration, context isolation on, sandboxed
  renderer, no preload bridge, external links open in the real browser, and
  permission requests are denied. The renderer only ever talks to its own origin,
  which the served CSP enforces.
- Electron-based editors export `ELECTRON_RUN_AS_NODE=1` into their terminals; the
  launch scripts strip it, or Electron would start as a plain Node process.
- No app icon is set yet, so builds carry the default Electron icon. Drop
  `icon.png` (512×512 or larger) into `build/` to replace it.
