import { defineConfig, TestProjectInlineConfiguration } from "vite-plus";
import { languageHashes } from "./vite-plugins/language-hashes";
import { envConfig } from "./vite-plugins/env-config";
import { devtoolsEntry } from "./vite-plugins/devtools-entry";
import solidPlugin from "vite-plugin-solid";

const plugins = [
  devtoolsEntry({ enabled: false }),
  languageHashes({ skip: true }),
  envConfig({ isDevelopment: true, clientVersion: "TESTING", env: {} }),
  solidPlugin({ hot: false }),
];

const tanstackSolidNoExternal: (string | RegExp)[] = [
  "@solidjs/meta",
  "@solidjs/router",
  /@tanstack\/solid-.*/,
];

export const projects = [
  {
    extends: false,
    test: {
      name: "start",
      include: [
        "__tests__/start/foundation.spec.ts",
        "__tests__/start/layers.spec.ts",
      ],
      environment: "node",
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  },
  {
    ssr: {
      noExternal: tanstackSolidNoExternal,
    },
    test: {
      name: { label: "unit", color: "blue" },
      include: ["__tests__/**/*.spec.ts"],
      exclude: ["__tests__/**/*.jsdom-spec.ts", "__tests__/start/**"],
      environment: "happy-dom",
      globalSetup: "__tests__/global-setup.ts",
      setupFiles: [
        "__tests__/__harness__/mock-application.ts",
        "__tests__/__harness__/mock-dom.ts",
        "__tests__/__harness__/mock-auth.ts",
        "__tests__/__harness__/mock-env-config.ts",
        "__tests__/__harness__/mock-static.ts",
      ],
    },
    plugins,
  },
  {
    ssr: {
      noExternal: tanstackSolidNoExternal,
    },
    test: {
      name: { label: "jsdom", color: "yellow" },
      include: ["__tests__/**/*.jsdom-spec.ts"],
      environment: "jsdom",
      globalSetup: "__tests__/global-setup.ts",
    },
    plugins,
  },
  {
    ssr: {
      noExternal: tanstackSolidNoExternal,
    },
    test: {
      name: { label: "jsx", color: "green" },
      include: ["__tests__/**/*.spec.tsx"],
      environment: "jsdom",
      globalSetup: "__tests__/global-setup.ts",
      setupFiles: [
        "__tests__/__harness__/setup-jsx.ts",
        "__tests__/__harness__/mock-application.ts",
        "__tests__/__harness__/mock-dom.ts",
      ],
      globals: true,
    },
    plugins,
  },
] satisfies TestProjectInlineConfiguration[];
export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    projects: projects,
    coverage: {
      include: ["**/*.ts", "**/*.tsx"],
    },
    deps: {
      optimizer: {
        web: {
          include: ["@oxytype/funbox"],
        },
      },
    },
  },
  plugins,
});
