import { prepareTypingEngine } from "./scripts/prepare-engine";
import { defineConfig, TestProjectInlineConfiguration } from "vite-plus";
import { projects as backendProjects } from "./backend/vitest.config";
import { projects as frontendProjects } from "./frontend/vitest.config";

prepareTypingEngine();

export default defineConfig({
  test: {
    // PostgreSQL fixtures allocate a WASM engine per file; bound worker memory.
    maxWorkers: 4,
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
      ...convertTests(backendProjects, "backend"),
      ...convertTests(frontendProjects, "frontend"),
      "packages/**/vitest.config.ts",
    ],
  },
});

function convertTests<T extends TestProjectInlineConfiguration>(
  projects: T[],
  root: string,
): T[] {
  return projects.map((it) => {
    const test = it.test ?? {};
    const name: string | { label: string } = test.name ?? "unknown";
    const updatedName =
      name === null || typeof name === "string"
        ? `${name}-${root}`
        : { ...name, label: `${name.label}-${root}` };

    return {
      ...it,
      test: {
        ...test,
        root,
        name: updatedName,
      },
    };
  });
}
