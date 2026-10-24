import { defineConfig, devices } from "playwright/test";

export default defineConfig<{ startSession: string | undefined }>({
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env["CI"]),
  // Intermittent failures used to fail the whole CI run; one retry reruns
  // just that test, and the report still marks it flaky.
  retries: Boolean(process.env["CI"]) ? 1 : 0,
  // CI adds inline annotations on the pull request diff.
  reporter: Boolean(process.env["CI"]) ? [["list"], ["github"]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4185",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "start", testDir: "./start-e2e" },
    {
      // Typing regression suite, against the built Start Worker.
      name: "typing-parity",
      testDir: "./e2e",
      testIgnore: ["**/*.migration.ts", "**/*.benchmark.ts"],
      use: { startSession: "browser-typing" },
    },
  ],
  webServer: {
    command: "vpx ./scripts/serve-start-fixture.ts",
    // The Worker listens before fixture sessions/config are seeded, so
    // readiness is the fixture's own signal, not the first HTTP response.
    wait: { stdout: /Start fixture ready/ },
    reuseExistingServer: false,
  },
});
