import { defineConfig, devices } from "playwright/test";
export default defineConfig({
  testDir: "./staging-e2e",
  outputDir: "./playwright-report/staging-artifacts",
  workers: 1,
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "https://oxytype-api-staging.voltcrash.workers.dev",
    trace: "retain-on-failure",
  },
});
