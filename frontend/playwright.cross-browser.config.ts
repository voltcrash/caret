import { defineConfig, devices } from "playwright/test";
import base from "./playwright.start.config";

export default defineConfig({
  ...base,
  projects: [
    {
      name: "firefox",
      testDir: "./cross-browser-e2e",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testDir: "./cross-browser-e2e",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "iphone",
      testDir: "./cross-browser-e2e",
      use: { ...devices["iPhone 13"] },
    },
    {
      name: "android",
      testDir: "./cross-browser-e2e",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
