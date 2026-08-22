import type { IncomingMessage, ServerResponse } from "node:http";
import {
  completeJson,
  envFlags,
  pickOllamaModel,
  probeOllama,
  resolveConfig,
  type ServerProvider,
} from "./modelProviders.ts";
import { localLlmModel, probeLocalLlm } from "./localLlm.ts";
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
  const [ollama, local] = await Promise.all([probeOllama(), probeLocalLlm(env)]);
  const flags = envFlags(env);
  flags.ollama = ollama.up;
  flags.local = local.up || flags.local;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      env: flags,
      ollama,
      local,
      // The VL box wins whenever it answers; a hosted key is only there to keep
      // the chat usable when the box is off.
      defaultProvider:
        env.ECON_AGENT_PROVIDER ??
        (local.up
          ? "local"
          : flags.replicate
            ? "replicate"
            : flags.gemini
              ? "gemini"
              : ollama.up
                ? "ollama"
                : "local"),
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
      locked?: boolean;
      attachments?: unknown[];
      provider?: ServerProvider;
      apiKey?: string;
      model?: string;
    };
    const [ollama, local] = await Promise.all([probeOllama(), probeLocalLlm(env)]);
    let config = resolveConfig(env, {
      provider: body.provider,
      apiKey: body.apiKey,
      model: body.model,
    });
    if (!config && local.up) {
      config = {
        provider: "local",
        apiKey: "",
        model: localLlmModel(env, body.model),
        baseUrl: local.url,
      };
    }
    if (!config && ollama.up) {
      config = { provider: "ollama", apiKey: "", model: "" };
    }
    if (config?.provider === "ollama") {
      // Ollama 404s on a model that was never pulled, so the name is always
      // reconciled against the install list rather than trusted.
      config.model = pickOllamaModel(body.model, env.ECON_AGENT_MODEL, ollama.models);
    }
    if (config?.provider === "local") {
      config.model = localLlmModel(env, body.model || config.model);
      config.baseUrl = config.baseUrl ?? local.url;
    }
    if (!config) {
      res.statusCode = 204;
      res.end();
      return;
    }

    const result = await completeJson(config, {
      text: body.text,
      role: body.role,
      locked: body.locked,
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
