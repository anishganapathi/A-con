import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = fileURLToPath(new URL(".", import.meta.url));

/**
 * Bundles the main process, pulling in the shared `server/` modules from the
 * repo above so the desktop app runs the same agent API as the dev server.
 * Node builtins stay external and are resolved at runtime.
 */
export default defineConfig({
  build: {
    outDir: `${here}dist`,
    emptyOutDir: false,
    target: "node22",
    minify: false,
    sourcemap: true,
    lib: {
      entry: { main: `${here}electron/main.ts` },
      formats: ["cjs"],
    },
    rollupOptions: {
      external: [
        "electron",
        ...builtinModules,
        ...builtinModules.map((name) => `node:${name}`),
      ],
      output: { entryFileNames: "[name].cjs" },
    },
  },
});
