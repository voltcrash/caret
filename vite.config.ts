import { prepareTypingEngine } from "./scripts/prepare-engine";
import {
  sharedLint,
  pluginLint,
  applicationDefaults,
} from "./packages/oxlint-config/config";
import { frontendLint } from "./frontend/lint.config";
import { backendLint } from "./backend/lint.config";
import { defineConfig } from "vite-plus";
import type { OxlintConfig, OxlintOverride } from "vite-plus/lint";

function applicationOverrides(
  directory: string,
  config: OxlintConfig,
): OxlintOverride[] {
  return [
    {
      files: [`${directory}/**`],
      jsPlugins: [...(pluginLint.jsPlugins ?? []), ...(config.jsPlugins ?? [])],
      rules: {
        ...applicationDefaults.rules,
        ...pluginLint.rules,
        ...config.rules,
      },
    },
    ...[...(pluginLint.overrides ?? []), ...(config.overrides ?? [])].map(
      (override) => ({
        ...override,
        files: override.files.map((pattern) => `${directory}/${pattern}`),
      }),
    ),
  ];
}

// Direct typechecking must work before any dev/build task has run.
if (
  process.argv.includes("--type-aware") ||
  process.argv.includes("--type-check")
) {
  prepareTypingEngine();
}

export default defineConfig({
  staged: {
    "*": "vp fmt --no-error-on-unmatched-pattern",
    "*.{ts,tsx,js}": "vp lint --type-aware --type-check --format agent",
    "*.css": "stylelint",
  },
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
  },
  fmt: {
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    htmlWhitespaceSensitivity: "ignore",
    endOfLine: "lf",
    trailingComma: "all",
    ignorePatterns: [
      "pnpm-lock.yaml",
      "node_modules",
      "dist",
      "build",
      "logs",
      "coverage",
      "*.md",
      // Owned by the TanStack Router generator; rewritten on every build.
      "frontend/src/routeTree.gen.ts",
    ],
    overrides: [
      {
        files: ["**/*.tsx"],
        options: {
          experimentalTailwindcss: {
            stylesheet: "./frontend/src/app/app.css",
            attributes: ["cn"],
            functions: ["cn"],
          },
          experimentalSortImports: {
            groups: [
              "type-import",
              ["value-builtin", "value-external"],
              "type-internal",
              "value-internal",
              ["type-parent", "type-sibling", "type-index"],
              ["value-parent", "value-sibling", "value-index"],
              "unknown",
            ],
          },
        },
      },
    ],
  },
  lint: {
    ignorePatterns: [
      "node_modules",
      "dist",
      "coverage",
      "backend/__migration__",
    ],
    extends: [sharedLint],
    overrides: [
      ...applicationOverrides("frontend", frontendLint),
      ...applicationOverrides("backend", backendLint),
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
    },
  },
});
