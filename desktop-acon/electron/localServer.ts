import { startAppServer, type RunningServer } from "../../server/httpServer.ts";

export type LocalServer = RunningServer;

/**
 * The desktop app's copy of the shared app server, pinned to loopback so a
 * packaged install never exposes the agent API to the network, and to port 0 so
 * two open windows or a stray process can never collide on a hardcoded one.
 */
export function startLocalServer(options: {
  root: string;
  env: Record<string, string>;
  host?: string;
}): Promise<LocalServer> {
  return startAppServer({
    root: options.root,
    env: options.env,
    host: options.host ?? "127.0.0.1",
    port: 0,
  });
}
