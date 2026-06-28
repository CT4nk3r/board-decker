import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.output",
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5599",
    viewport: { width: 1100, height: 220 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx vite --config vite.harness.config.ts",
    url: "http://localhost:5599",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
