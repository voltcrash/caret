import { resolve } from "node:path";
import { defineConfig, type TestProjectInlineConfiguration } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { envConfig } from "./vite-plugins/env-config";
import { languageHashes } from "./vite-plugins/language-hashes";
import { operationTransport } from "./vite-plugins/operation-transport";
import { fontStyles } from "./vite-plugins/font-styles";
import { nodeTests } from "./vitest.node-tests";

const root = import.meta.dirname;
const functions = new Map([
  [
    resolve(root, "src/functions/session.ts"),
    resolve(root, "__tests__/__harness__/session-function.ts"),
  ],
  [
    resolve(root, "src/functions/signup.ts"),
    resolve(root, "__tests__/__harness__/signup-function.ts"),
  ],
]);
for (const name of ["profile", "leaderboards", "account"]) {
  functions.set(
    resolve(root, `src/functions/${name}.ts`),
    resolve(root, "__tests__/__harness__/read-functions.ts"),
  );
}

export const browserProject = {
  extends: false,
  root,
  define: { "import.meta.env.OXYTYPE_BUILD_ID": JSON.stringify("TESTING") },
  resolve: {
    alias: [
      {
        find: /^@tanstack\/solid-start$/,
        replacement: resolve(root, "__tests__/__harness__/start-client.ts"),
      },
    ],
  },
  // Convert CommonJS dependencies without scanning uncompiled server functions.
  optimizeDeps: {
    noDiscovery: true,
    include: [
      "solid-js",
      "solid-js/web",
      "solid-js/store",
      "@testing-library/jest-dom/vitest",
      "@solidjs/testing-library",
      "@testing-library/user-event",
      "object-hash",
      "hangul-js",
      "howler",
      "damerau-levenshtein",
      "lz-ts",
    ],
  },
  plugins: [
    {
      name: "browser-test-boundaries",
      enforce: "pre",
      async resolveId(source, importer, options) {
        if (
          source.includes(".server") ||
          source === "@tanstack/solid-start/server"
        ) {
          throw new Error(
            `Server code reached browser tests: ${source} from ${importer}`,
          );
        }
        // Browser Mode records mock importers as URLs relative to the Vite root.
        const actualImporter = importer?.startsWith("/__tests__/")
          ? resolve(root, `.${importer}`)
          : importer;
        if (!source.includes("functions/") && actualImporter === importer) {
          return null;
        }
        const resolved = await this.resolve(source, actualImporter, {
          ...options,
          skipSelf: true,
        });
        return (
          functions.get(resolved?.id.split("?")[0] ?? "") ??
          (actualImporter === importer ? null : resolved)
        );
      },
    },
    operationTransport(resolve(root, "__tests__/__harness__/operations.ts")),
    languageHashes({ skip: true }),
    envConfig({ isDevelopment: true, clientVersion: "TESTING", env: {} }),
    solid({ hot: false }),
    fontStyles(),
    tailwindcss(),
  ],
  test: {
    name: "browser",
    root,
    include: [
      "__tests__/**/*.spec.ts",
      "__tests__/**/*.spec.tsx",
      "__tests__/**/*.browser.tsx",
    ],
    exclude: [...nodeTests, "__tests__/start/**"],
    setupFiles: [
      "__tests__/browser/setup.ts",
      "__tests__/__harness__/mock-application.ts",
      "__tests__/__harness__/mock-dom.ts",
      "__tests__/__harness__/mock-static.ts",
    ],
    globals: true,
    testTimeout: 10_000,
    hookTimeout: 10_000,
    // Keep browser resource use bounded; CI parallelizes independent file shards.
    fileParallelism: false,
    maxWorkers: 1,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({ contextOptions: { timezoneId: "UTC" } }),
      instances: [{ browser: "chromium" }],
    },
  },
} satisfies TestProjectInlineConfiguration;

export default defineConfig({
  root,
  test: { clearMocks: false, maxWorkers: 2, projects: [browserProject] },
});
