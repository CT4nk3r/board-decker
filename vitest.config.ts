import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for pure logic + small DOM components. The Playwright e2e harness
// lives under e2e/ and is excluded from this runner.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    globals: false,
  },
});
