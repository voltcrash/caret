/// <reference types="node" />
import type { KnipConfig } from "knip";
import process from "node:process";

// Only Knip loads this file. Real production builds retain their missing-key guard.
process.env.TURNSTILE_SITE_KEY ??= "1x00000000000000000000AA";

export default {
  // Installed through the pinned Cargo bootstrap, not a JavaScript dependency.
  ignoreBinaries: ["wasm-bindgen"],
  workspaces: {
    ".": {
      entry: [
        "vitest.config.ts",
        // Invoked manually by the documented local security audit workflow.
        "docs/security/reproduce-account-controls.mts",
      ],
      vitest: false,
    },
    backend: {
      entry: ["scripts/*.ts"],
      project: ["src/**/*.ts", "scripts/**/*.ts", "__tests__/**/*.ts"],
      // Shared lint config is consumed through Vite+ rather than application imports.
      ignoreDependencies: ["@oxytype/oxlint-config"],
    },
    frontend: {
      entry: [
        "src/ts/types/*.d.ts",
        "scripts/*.{ts,cjs}",
        // Vitest's operation map is an aliased entry (operation-transport).
        "__tests__/__harness__/operations.ts",
        // Browser tests replace Start compiler/server entries through Vite aliases.
        "__tests__/__harness__/start-client.ts",
        "__tests__/__harness__/session-function.ts",
        "__tests__/__harness__/signup-function.ts",
        "__tests__/__harness__/read-functions.ts",
        // Built-Worker test entry, selected by `vp build --mode runtime-test`.
        "__tests__/start/worker-entry.ts",
        // Compiled independently by the Start service-worker build plugin.
        "src/sw/service-worker.ts",
      ],
      project: [
        "src/**/*.{ts,tsx,css}",
        "vite-plugins/**/*.ts",
        "scripts/**/*.{ts,cjs}",
        "__tests__/**/*.{ts,tsx}",
      ],
      ignoreDependencies: [
        // Vite+ resolves the shared lint config and ESLint plugins at runtime.
        "@oxytype/oxlint-config",
        "@tanstack/eslint-plugin-query",
        "eslint-plugin-compat",
        "eslint-plugin-solid",
        // font-styles.ts provides these CSS modules through its Vite plugin.
        "oxytype-fontawesome.css",
        "oxytype-fonts.css",
      ],
    },
    "frontend/storybook": {
      storybook: false,
      entry: [
        ".storybook/*.{ts,tsx}",
        "stories/**/*.{stories.ts,stories.tsx,mdx}",
      ],
      project: [".storybook/**/*.{ts,tsx}", "stories/**/*.{ts,tsx,css}"],
    },
    "packages/release": {
      entry: ["src/production-validation.js", "__tests__/*.spec.js"],
    },
    "packages/web-shared": {
      // Base config is consumed through tsconfig extends, like the SDK package.
      ignoreDependencies: ["@oxytype/typescript-config"],
    },
    "packages/typing-engine": {
      // This package's browser-only declarations use the workspace TS base;
      // Knip's default entry analysis does not inspect this tsconfig reference.
      ignoreDependencies: ["@oxytype/typescript-config"],
    },
    "packages/oxlint-config": {
      entry: ["plugins/*.js"],
      project: ["plugins/*.js"],
    },
  },
  ignoreDependencies: [
    // Browserslist uses the pinned database indirectly for compatibility linting.
    "caniuse-lite",
    // scripts/engine.ts resolves Binaryen's package metadata to invoke wasm-opt.
    "binaryen",
    // .vite-hooks/commit-msg invokes the commitlint binary.
    "@commitlint/cli",
  ],
} satisfies KnipConfig;
