import { defineConfig, devices } from "playwright/test";
export default defineConfig({
  testDir: "./update-e2e",
  workers: 1,
  retries: 0,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4186",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "vp exec tsx scripts/serve-update-fixture.ts",
    url: "http://127.0.0.1:4186",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
