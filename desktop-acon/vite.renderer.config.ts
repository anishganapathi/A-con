import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vite";
import webConfig from "../vite.config.ts";

const here = fileURLToPath(new URL(".", import.meta.url));

/**
 * The desktop app has no source of its own: it builds the web app's `src` with
 * the web app's own Vite config, so the two can never drift. Only the root and
 * the output location differ.
 */
export default defineConfig(
  mergeConfig(webConfig, {
    root: fileURLToPath(new URL("..", import.meta.url)),
    build: {
      outDir: `${here}dist/renderer`,
      emptyOutDir: true,
    },
  }),
);
