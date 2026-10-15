import { defineConfig, devices } from "playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env["CI"]),
  retries: Boolean(process.env["CI"]) ? 1 : 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "vp dev --config vite.legacy.config.ts --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    env: {
      DEV_OFFLINE: "false",
      BACKEND_URL: "http://127.0.0.1:4173/api",
      SERVER_OPEN: "false",
      DEV_TOOLS: "false",
      DEV_LINT: "false",
      DEV_INSPECT: "false",
    },
  },
});
