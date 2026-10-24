import { defineConfig, type TestProjectInlineConfiguration } from "vite-plus";
import { browserProject } from "./vitest.browser.config";
import { nodeTests } from "./vitest.node-tests";

export const projects = [
  {
    extends: false,
    test: {
      name: "node",
      env: { TZ: "UTC" },
      include: nodeTests,
      environment: "node",
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  },
  browserProject,
] satisfies TestProjectInlineConfiguration[];

export default defineConfig({
  test: {
    // Preserve existing mock history while migrating execution environments.
    clearMocks: false,
    maxWorkers: 2,
    sharedViteServer: false,
    projects,
    coverage: { include: ["**/*.ts", "**/*.tsx"] },
  },
});
