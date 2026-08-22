import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import electron from "electron";
import { build, createServer } from "vite";
import { electronEnv } from "./electronEnv.mjs";

const here = fileURLToPath(new URL("..", import.meta.url));

/**
 * Development runs the real Vite dev server — the same one `npm run dev` starts
 * in the web app, agent API middleware and hot reload included — and points the
 * Electron window at it. The desktop shell is then the only thing that differs
 * from developing in a browser.
 */
const server = await createServer({
  configFile: `${here}vite.renderer.config.ts`,
  server: { host: "127.0.0.1" },
});
await server.listen();
server.printUrls();

const url = server.resolvedUrls?.local?.[0];
if (!url) {
  await server.close();
  throw new Error("Vite dev server did not report a local URL");
}

await build({ configFile: `${here}vite.main.config.ts`, logLevel: "warn" });

const child = spawn(electron, ["."], {
  cwd: here,
  stdio: "inherit",
  env: electronEnv(process.env, { ELECTRON_RENDERER_URL: url, NODE_ENV: "development" }),
});

const shutdown = async (code) => {
  await server.close();
  process.exit(code ?? 0);
};

child.on("close", (code) => void shutdown(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill();
  });
}
