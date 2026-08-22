import type { IncomingMessage, ServerResponse } from "node:http";
import {
  completeJson,
  envFlags,
  pickOllamaModel,
  probeCursorLogin,
  probeOllama,
  resolveConfig,
  type ServerProvider,
} from "./modelProviders.ts";
import { lookupNycBuilding } from "./nycGis.ts";

/**
 * The agent API, independent of whatever is hosting it. The Vite dev server
 * mounts these as middleware; the Electron app serves them from its own HTTP
 * server, so the desktop build talks to the same endpoints as the web build.
 */
export type AgentEnv = Record<string, string>;

export async function handleGis(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = (await readJson(req)) as { query?: string };
    const query = body.query?.trim();
    if (!query) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Missing query" }));
      return;
    }
    const building = await lookupNycBuilding(query);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(building));
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "NYC GIS lookup failed",
      }),
    );
  }
}

export async function handleStatus(env: AgentEnv, res: ServerResponse) {
  const [ollama, cursorLogin] = await Promise.all([probeOllama(), probeCursorLogin()]);
  const flags = envFlags(env, { cursorLogin });
  flags.ollama = ollama.up;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      env: flags,
      ollama,
      cursorLogin,
      defaultProvider:
        env.ECON_AGENT_PROVIDER ??
        (flags.replicate
          ? "replicate"
          : flags.gemini
            ? "gemini"
            : flags.cursor
              ? "cursor"
              : ollama.up
                ? "ollama"
                : "cursor"),
    }),
  );
}

export async function handleAgent(
  env: AgentEnv,
  req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    const body = (await readJson(req)) as {
      text?: string;
      role?: string;
      plan?: string;
      attachments?: unknown[];
      provider?: ServerProvider;
      apiKey?: string;
      model?: string;
    };
    const [ollama, cursorLogin] = await Promise.all([probeOllama(), probeCursorLogin()]);
    let config = resolveConfig(
      env,
      {
        provider: body.provider,
        apiKey: body.apiKey,
        model: body.model,
      },
      { cursorLogin },
    );
    if (!config && ollama.up) {
      config = { provider: "ollama", apiKey: "", model: "" };
    }
    if (config?.provider === "ollama") {
      // Ollama 404s on a model that was never pulled, so the name is always
      // reconciled against the install list rather than trusted.
      config.model = pickOllamaModel(body.model, env.ECON_AGENT_MODEL, ollama.models);
    }
    if (!config) {
      res.statusCode = 204;
      res.end();
      return;
    }

    const result = await completeJson(config, {
      text: body.text,
      role: body.role,
      plan: body.plan,
      attachments: body.attachments ?? [],
    });
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ...result.parsed,
        model: result.model,
        provider: result.provider,
      }),
    );
  } catch (error) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Agent API failed",
      }),
    );
  }
}

export function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}
