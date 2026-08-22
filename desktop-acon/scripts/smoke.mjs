import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import electron from "electron";
import { electronEnv } from "./electronEnv.mjs";

const here = fileURLToPath(new URL("..", import.meta.url));

/**
 * Launches the built app, lets it report on its own renderer, and exits with
 * its verdict. Verifies a packaged-style run without a person at the screen.
 */
const child = spawn(electron, ["."], {
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
  process.exit(code ?? 1);
});
