import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { startAppServer } from "./httpServer.ts";
import { localLlmBaseUrl, localLlmModel } from "./localLlm.ts";

/**
 * Production entrypoint: serves `dist/` and the agent API over one port.
 *
 * Run it with `npm start` after `npm run build`. Node strips the TypeScript in
 * these files itself from v22.18, so there is no build step for the server —
 * only the renderer is compiled.
 */
const root = fileURLToPath(new URL("../dist", import.meta.url));
const envFile = fileURLToPath(new URL("../.env", import.meta.url));

if (!existsSync(root)) {
  console.error(`No renderer build at ${root}. Run \`npm run build\` first.`);
  process.exit(1);
}

// Matches the dev server, which reads .env through Vite's loadEnv. Without this
// a ECON_LOCAL_LLM_URL that works in dev would silently stop applying in
// production. Real environment variables still win: loadEnvFile does not
// overwrite what is already set.
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

const host = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 4173);

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`PORT must be a port number, got "${process.env.PORT}".`);
  process.exit(1);
}

const env = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);

const server = await startAppServer({ root, env, host, port });

console.log(`Acon listening on http://${host}:${server.port}`);
// The default base URL is a specific LAN address rather than loopback, so print
// what actually resolved — pointing at the wrong box is otherwise invisible
// until the first chat message fails.
console.log(`Vision model: ${localLlmModel(env)} at ${localLlmBaseUrl(env)}`);

// systemd stops units with SIGTERM and expects them to exit rather than be
// killed after the timeout.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
