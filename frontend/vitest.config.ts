import { defineConfig, TestProjectInlineConfiguration } from "vite-plus";
import { languageHashes } from "./vite-plugins/language-hashes";
import { envConfig } from "./vite-plugins/env-config";
import solidPlugin from "vite-plugin-solid";
import { resolve } from "node:path";
import { operationTransport } from "./vite-plugins/operation-transport";

const plugins = [
  // Unit tests never load server functions; operations answer from a fake.
  operationTransport(
    resolve(import.meta.dirname, "__tests__/__harness__/operations.ts"),
  ),
  languageHashes({ skip: true }),
  envConfig({ isDevelopment: true, clientVersion: "TESTING", env: {} }),
  solidPlugin({ hot: false }),
];

const tanstackSolidNoExternal: (string | RegExp)[] = [
  "@solidjs/meta",
  /@tanstack\/solid-.*/,
];

// Inline projects also run through the repository's aggregate config.
const define = {
  "import.meta.env.OXYTYPE_BUILD_ID": JSON.stringify("TESTING"),
};

// Pure tests skip DOM emulation and application-owner mocks.
const nodeTests = [
  "__tests__/scripts/**/*.spec.ts",
  "__tests__/vite-plugins/**/*.spec.ts",
  "__tests__/styles/**/*.spec.ts",
  "__tests__/utils/{colors,ip-addresses,key-converter,migration-performance,numbers,result-hash,settings-search,zod}.spec.ts",
  "__tests__/elements/**/*.spec.ts",
  "__tests__/components/pages/test/keymapConverter.spec.ts",
];

export const projects = [
  {
    extends: false,
    test: {
      name: "node",
      include: [
        ...nodeTests,
        "__tests__/start/foundation.spec.ts",
        "__tests__/start/layers.spec.ts",
        "__tests__/start/operation-functions.spec.ts",
      ],
      environment: "node",
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  },
  {
    define,
    ssr: {
      noExternal: tanstackSolidNoExternal,
    },
    test: {
      name: { label: "unit", color: "blue" },
      include: ["__tests__/**/*.spec.ts"],
      exclude: [...nodeTests, "__tests__/start/**"],
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
    define,
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
    define,
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
  // Start builds define it; unit tests use the same fixed client version.
  define,
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
