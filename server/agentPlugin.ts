import { loadEnv, type Plugin, type ViteDevServer } from "vite";
import { handleAgent, handleGis, handleStatus } from "./agentApi.ts";

export function agentPlugin(): Plugin {
  return {
    name: "econ-agent",
    configureServer(server) {
      server.middlewares.use("/api/agent", (req, res, next) => {
        if (req.method === "GET") {
          void handleStatus(envFrom(server), res);
          return;
        }
        if (req.method !== "POST") {
          next();
          return;
        }
        void handleAgent(envFrom(server), req, res);
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
