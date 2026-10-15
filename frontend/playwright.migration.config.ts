import { defineConfig } from "playwright/test";
import config from "./playwright.config";

/** Production assets, deterministic API fixtures; never contacts production. */
export default defineConfig({
  ...config,
  testMatch: "**/*.migration.ts",
  timeout: 120_000,
  webServer: {
    command:
      "vp preview --config vite.migration.config.ts --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    env: { TURNSTILE_SITE_KEY: "1x00000000000000000000AA" },
  },
});
