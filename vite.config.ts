import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { agentPlugin } from "./server/agentPlugin.ts";

export default defineConfig({
  plugins: [react(), agentPlugin()],
});
