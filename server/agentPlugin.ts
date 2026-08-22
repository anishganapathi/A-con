import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv, type Plugin, type ViteDevServer } from "vite";
import {
  completeJson,
  envFlags,
  probeOllama,
  resolveConfig,
  type ServerProvider,
} from "./modelProviders.ts";
import { lookupNycBuilding } from "./nycGis.ts";

export function agentPlugin(): Plugin {
  return {
    name: "econ-agent",
    configureServer(server) {
      server.middlewares.use("/api/agent", (req, res, next) => {
        if (req.method === "GET") {
          void handleStatus(server, res);
          return;
        }
        if (req.method !== "POST") {
          next();
          return;
        }
        void handleAgent(server, req, res);
      });
      server.middlewares.use("/api/gis", (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        void handleGis(req, res);
      });
    },
  };
}

async function handleGis(req: IncomingMessage, res: ServerResponse) {
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

function envFrom(server: ViteDevServer): Record<string, string> {
  return {
    ...loadEnv(server.config.mode, server.config.envDir, ""),
    ...Object.fromEntries(
      Object.entries(process.env).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
  };
}

async function handleStatus(server: ViteDevServer, res: ServerResponse) {
  const env = envFrom(server);
  const ollama = await probeOllama();
  const flags = envFlags(env);
  flags.ollama = ollama.up;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      env: flags,
      ollama,
      defaultProvider:
        env.ECON_AGENT_PROVIDER ??
        (flags.replicate ? "replicate" : flags.gemini ? "gemini" : "cursor"),
    }),
  );
}

async function handleAgent(
  server: ViteDevServer,
  req: IncomingMessage,
  res: ServerResponse,
) {
  const env = envFrom(server);
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
    const ollama = await probeOllama();
    let config = resolveConfig(env, {
      provider: body.provider,
      apiKey: body.apiKey,
      model: body.model,
    });
    if (!config && ollama.up) {
      config = {
        provider: "ollama",
        apiKey: "",
        model: body.model || env.ECON_AGENT_MODEL || ollama.models[0] || "llama3.2",
      };
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

function readJson(req: IncomingMessage): Promise<unknown> {
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
