import { createReadStream, statSync, type Stats } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { handleAgent, handleGis, handleStatus, type AgentEnv } from "./agentApi.ts";
import { contentType, resolveStaticPath } from "./static.ts";

export interface RunningServer {
  url: string;
  port: number;
  close: () => Promise<void>;
}

export interface ServeOptions {
  /** Directory holding the built renderer — the `dist` from `vite build`. */
  root: string;
  env: AgentEnv;
  host?: string;
  /** Omit or pass 0 to take whatever port the OS hands out. */
  port?: number;
}

/**
 * Serves the built renderer and the agent API from one origin.
 *
 * In development Vite hosts both: it serves the renderer and `agentPlugin`
 * mounts the API as middleware. Nothing outside `vite dev` has that, so a
 * packaged desktop app and a deployed web build would otherwise ship a UI whose
 * `fetch("/api/agent")` calls 404. This is what stands in for the dev server.
 */
export function startAppServer(options: ServeOptions): Promise<RunningServer> {
  const host = options.host ?? "127.0.0.1";
  const server = createServer((req, res) => {
    void route(req, res, options.root, options.env);
  });

  return new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(options.port ?? 0, host, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        rejectPromise(new Error("Server did not bind to a port"));
        return;
      }
      resolvePromise({
        url: `http://${host}:${address.port}`,
        port: address.port,
        close: () => closeServer(server),
      });
    });
  });
}

async function route(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
  env: AgentEnv,
) {
  const path = (req.url ?? "/").split("?")[0];

  if (path === "/api/agent") {
    if (req.method === "GET") {
      await handleStatus(env, res);
      return;
    }
    if (req.method === "POST") {
      await handleAgent(env, req, res);
      return;
    }
    send(res, 405, "Method Not Allowed");
    return;
  }

  if (path === "/api/gis") {
    if (req.method === "POST") {
      await handleGis(req, res);
      return;
    }
    send(res, 405, "Method Not Allowed");
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "Method Not Allowed");
    return;
  }
  serveStatic(res, root, req.url ?? "/", req.method === "HEAD");
}

function serveStatic(res: ServerResponse, root: string, url: string, headOnly: boolean) {
  const file = resolveStaticPath(root, url);
  const stats = file ? statOrNull(file) : null;
  if (!file || !stats?.isFile()) {
    send(res, 404, "Not Found");
    return;
  }
  const type = contentType(file);
  res.statusCode = 200;
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Length", stats.size);
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (type.startsWith("text/html")) {
    // The renderer only ever talks to this server, so everything else is shut
    // off. Inline styles stay allowed: drei's Html overlays set them directly.
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        // data: covers the bundled HDRI environment map, which the loader reads
        // as a data URI rather than a file.
        "connect-src 'self' data:",
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join("; "),
    );
  }
  // The bundle is rebuilt on every release and filenames are hashed, so the
  // shell must never be cached across versions.
  res.setHeader("Cache-Control", "no-store");
  if (headOnly) {
    res.end();
    return;
  }
  createReadStream(file)
    .on("error", () => send(res, 500, "Read failed"))
    .pipe(res);
}

function statOrNull(file: string): Stats | null {
  try {
    return statSync(file);
  } catch {
    return null;
  }
}

function send(res: ServerResponse, status: number, message: string) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(message);
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolvePromise) => {
    server.close(() => resolvePromise());
  });
}
