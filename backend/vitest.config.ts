import { defineConfig, TestProjectInlineConfiguration } from "vite-plus";

export const projects = [
  {
    test: {
      name: { label: "d1", color: "cyan" },
      include: ["__tests__/d1/**/*.spec.ts"],
      testTimeout: 30_000,
      hookTimeout: 30_000,
      // Each file migrates its own in-memory Miniflare D1, so files are isolated.
    },
  },
  {
    test: {
      name: { label: "http", color: "yellow" },
      setupFiles: ["__tests__/setup-tests.ts"],
      include: ["__tests__/{api,auth,http}/**/*.spec.ts"],
    },
  },
  {
    test: {
      name: { label: "unit", color: "blue" },
      setupFiles: ["__tests__/setup-unit.ts"],
      include: ["__tests__/**/*.spec.ts"],
      exclude: ["__tests__/{api,auth,http,d1}/**"],
    },
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
    environment: "node",
    pool: "forks",
    coverage: {
      include: ["**/*.ts"],
    },
  },
});
