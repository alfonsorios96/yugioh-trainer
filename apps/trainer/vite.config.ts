import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@content": path.resolve(__dirname, "../../content"),
      "@engines": path.resolve(__dirname, "../../packages/windbot-engines"),
      "@yugioh/edopro-bridge": path.resolve(
        __dirname,
        "../../packages/edopro-bridge/src/index.ts",
      ),
      "@yugioh/coach": path.resolve(__dirname, "../../packages/coach/src/index.ts"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
