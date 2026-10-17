import { defineConfig, devices } from "playwright/test";

/** Word-rendering benchmark, mounted by the native Start typing leaf. */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.benchmark.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env["CI"]),
  retries: 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4186",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "vp dev --mode offline --host 127.0.0.1 --port 4186 --strictPort",
    url: "http://127.0.0.1:4186",
    reuseExistingServer: false,
  },
});
