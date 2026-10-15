import type { UserConfig } from "vite-plus";
import { createRequire } from "node:module";
import { projects } from "./vitest.config";

// Vite+ 1.0's guard compares against its compiled-in 5.0.1 constant, despite
// pnpm's override running Vitest 5.0.3. Check the actual installed pair instead.
const require = createRequire(import.meta.url);
const runner = require("vitest/package.json") as { version: string };
const coverage = require("@vitest/coverage-v8/package.json") as {
  version: string;
};
if (runner.version !== coverage.version) {
  throw new Error(
    `Coverage ${coverage.version} must match Vitest ${runner.version}`,
  );
}

export default {
  test: {
    clearMocks: false,
    projects: projects.map((project) => ({ ...project, extends: false })),
    environment: "node",
    pool: "forks",
    coverage: {
      provider: "v8",
      include: [
        "src/services/operations/result.ts",
        "src/services/operations/result/**/*.ts",
        "src/dal/user.ts",
        "src/dal/user/**/*.ts",
        "src/services/operations/user/**/*.ts",
      ],
      reporter: ["text", "json-summary"],
    },
  },
} satisfies UserConfig;
