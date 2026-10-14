/// <reference types="vite-plus" />
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite-plus/test/config";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "vite-plus/test/browser-playwright";
import type { TestProjectInlineConfiguration } from "vite-plus";

type BrowserConfig = NonNullable<
  NonNullable<TestProjectInlineConfiguration["test"]>["browser"]
>;
// The runtime runner/provider are both overridden to 5.0.3; Vite+ 1.0 ships
// provider declarations from 5.0.1. Bind that boundary to the runner's config type.
const browserProvider = playwright() as unknown as NonNullable<
  BrowserConfig["provider"]
>;

const dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [],
  define: {
    "process.env": {},
  },
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    // Vitest v4 compatibility: keep separate Vite servers for inline projects.
    // Remove when plugins and config hooks can run once for shared projects.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#inline-projects-share-the-vite-server-by-default
    sharedViteServer: false,
    projects: [
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            locators: {
              // Vitest v4 compatibility: keep partial, case-insensitive locator matching.
              // Remove after updating locators for full, case-sensitive matches.
              // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
              // https://vitest.dev/guide/migration/#locators-are-strict-by-default
              exact: false,
            },
            enabled: true,
            headless: true,
            provider: browserProvider,
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
        },
      },
    ],
  },
});
