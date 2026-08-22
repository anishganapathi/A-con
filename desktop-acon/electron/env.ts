import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The dev server reads provider keys through Vite's `loadEnv`. A packaged app
 * has no Vite, so the same files are read here with the same precedence:
 * `.env` < `.env.local` < `.env.<mode>` < `.env.<mode>.local`, and a real
 * environment variable outranks all of them.
 */
export function loadDotEnv(dir: string, mode = "production"): Record<string, string> {
  const files = [".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`];
  const env: Record<string, string> = {};
  for (const name of files) {
    const path = join(dir, name);
    if (!existsSync(path)) {
      continue;
    }
    Object.assign(env, parseDotEnv(readFileSync(path, "utf8")));
  }
  return env;
}

export function parseDotEnv(body: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const split = line.indexOf("=");
    if (split <= 0) {
      continue;
    }
    const key = line.slice(0, split).replace(/^export\s+/, "").trim();
    if (!key) {
      continue;
    }
    env[key] = unquote(line.slice(split + 1).trim());
  }
  return env;
}

function unquote(value: string): string {
  const quoted =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));
  return quoted && value.length >= 2 ? value.slice(1, -1) : value;
}

export function mergeProcessEnv(env: Record<string, string>): Record<string, string> {
  return {
    ...env,
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
  };
}
