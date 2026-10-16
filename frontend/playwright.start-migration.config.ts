import { defineConfig } from "playwright/test";
import config from "./playwright.start.config";

/** Readiness benchmark against the built Start Worker and its D1 fixtures. */
export default defineConfig({
  ...config,
  projects: undefined,
  testDir: "./e2e",
  testMatch: "**/*.migration.ts",
  timeout: 120_000,
});
