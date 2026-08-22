import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { agentPlugin } from "./server/agentPlugin.ts";

const cityHdri = fileURLToPath(
  new URL("./node_modules/@pmndrs/assets/hdri/city.exr.js", import.meta.url),
);

export default defineConfig({
  plugins: [react(), agentPlugin()],
  resolve: {
    alias: {
      "@pmndrs/assets/hdri/city.exr.js": cityHdri,
    },
  },
  server: {
    watch: {
      // The desktop shell builds this same source into desktop-acon; its output
      // is a build artefact, not app source, and must not trigger reloads.
      ignored: ["**/desktop-acon/dist/**", "**/desktop-acon/release/**"],
    },
  },
});
