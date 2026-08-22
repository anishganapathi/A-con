import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { agentPlugin } from "./server/agentPlugin.ts";

export default defineConfig({
  plugins: [react(), agentPlugin()],
  server: {
    watch: {
      // The desktop shell builds this same source into desktop-acon; its output
      // is a build artefact, not app source, and must not trigger reloads.
      ignored: ["**/desktop-acon/dist/**", "**/desktop-acon/release/**"],
    },
  },
});
