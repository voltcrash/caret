import type { KnipConfig } from "knip";

export default {
  workspaces: {
    ".": {
      entry: ["vitest.config.ts"],
      vitest: false,
    },
    backend: {
      entry: ["scripts/*.ts"],
      project: ["src/**/*.ts", "scripts/**/*.ts", "__tests__/**/*.ts"],
      ignoreDependencies: ["@oxytype/oxlint-config"],
    },
    frontend: {
      entry: [
        "src/ts/index.ts",
        "src/ts/{oauth-callback,not-found,privacy-policy,standalone-renderer}.tsx",
        "src/ts/types/*.d.ts",
        "src/styles/{tailwind,standalone}.css",
        "scripts/*.{ts,cjs}",
      ],
      project: [
        "src/**/*.{ts,tsx,css}",
        "vite-plugins/**/*.ts",
        "scripts/**/*.{ts,cjs}",
        "__tests__/**/*.{ts,tsx}",
      ],
      ignore: ["src/ts/utils/debug.ts"],
      ignoreDependencies: [
        "@oxytype/oxlint-config",
        "@tanstack/eslint-plugin-query",
        "eslint-plugin-compat",
        "eslint-plugin-solid",
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
      ignoreDependencies: ["@storybook/addon-links"],
    },
    "packages/release": {
      entry: ["src/production-release.js", "__tests__/*.spec.js"],
    },
    tui: {
      entry: ["bin/*.ts"],
    },
    "packages/typing-core": {
      entry: ["scripts/*.ts"],
    },
    "packages/oxlint-config": {
      entry: ["plugins/*.js"],
      project: ["plugins/*.js"],
    },
  },
  ignoreDependencies: ["caniuse-lite", "@commitlint/cli"],
} satisfies KnipConfig;
