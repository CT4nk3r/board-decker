import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Standalone Vite app that mounts the real UpdateButton with the two Tauri
// plugin modules aliased to browser mocks, so Playwright can drive every state.
export default defineConfig({
  root: path.resolve(__dirname, "./e2e/harness"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@tauri-apps/api/core": path.resolve(__dirname, "./e2e/harness/mocks/ado-invoke.ts"),
      "@": path.resolve(__dirname, "./src"),
      "@tauri-apps/plugin-updater": path.resolve(
        __dirname,
        "./e2e/harness/mocks/plugin-updater.ts",
      ),
      "@tauri-apps/plugin-process": path.resolve(
        __dirname,
        "./e2e/harness/mocks/plugin-process.ts",
      ),
      "@tauri-apps/api/core": path.resolve(
        __dirname,
        "./e2e/harness/mocks/core.ts",
      ),
    },
  },
  server: { port: 5599, strictPort: true },
});
