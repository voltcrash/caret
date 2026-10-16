import { defineConfig } from "playwright/test";
import config from "./playwright.benchmark.config";

/** Same renderer/fixtures as Stage 0, mounted by the native Start leaf. */
export default defineConfig({
  ...config,
  projects: [{ name: "start-rendering" }],
  use: { ...config.use, baseURL: "http://127.0.0.1:4186" },
  webServer: {
    command: "vp dev --mode offline --host 127.0.0.1 --port 4186 --strictPort",
    url: "http://127.0.0.1:4186",
    reuseExistingServer: false,
  },
});
