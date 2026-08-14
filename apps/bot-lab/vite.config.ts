import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@yugioh/edopro-bridge": path.resolve(
        __dirname,
        "../../packages/edopro-bridge/src/index.ts",
      ),
      "@yugioh/bot-lab": path.resolve(
        __dirname,
        "../../packages/bot-lab/src/index.ts",
      ),
    },
  },
  clearScreen: false,
  server: {
    port: 1430,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1431,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
