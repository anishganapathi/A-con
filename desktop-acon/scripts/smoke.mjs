import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import electron from "electron";
import { electronEnv } from "./electronEnv.mjs";

const here = fileURLToPath(new URL("..", import.meta.url));
// Its own profile, so a copy of the app already open on the desktop does not
// hand this run straight to the single-instance lock, which would exit 0 mute.
const profile = mkdtempSync(join(tmpdir(), "acon-smoke-"));

/**
 * Launches the built app, lets it report on its own renderer, and exits with
 * its verdict. Verifies a packaged-style run without a person at the screen.
 */
const child = spawn(electron, [".", `--user-data-dir=${profile}`], {
  cwd: here,
  stdio: "inherit",
  env: electronEnv(process.env, { ACON_SMOKE: "1" }),
});

const timeout = setTimeout(() => {
  console.error("smoke: timed out after 60s");
  child.kill("SIGKILL");
  process.exit(1);
}, 60_000);

child.on("close", (code) => {
  clearTimeout(timeout);
  rmSync(profile, { recursive: true, force: true });
  process.exit(code ?? 1);
});
