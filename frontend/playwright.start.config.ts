import { defineConfig, devices } from "playwright/test";

export default defineConfig({
  testDir: "./start-e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env["CI"]),
  retries: 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4185",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "vp exec tsx scripts/serve-start-fixture.ts",
    url: "http://127.0.0.1:4185",
    reuseExistingServer: false,
  },
});
