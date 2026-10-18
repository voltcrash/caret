import { createRequire } from "node:module";
import { sharedLint, pluginLint } from "../packages/oxlint-config/config";
import type { OxlintConfig } from "vite-plus/lint";

const require = createRequire(import.meta.url);

export const frontendLint: OxlintConfig = {
  ignorePatterns: [
    "node_modules",
    "dist",
    "coverage",
    ".firebase",
    ".standalone-generated",
    "src/routeTree.gen.ts",
  ],
  extends: [sharedLint, pluginLint],
  options: {
    typeAware: false,
    typeCheck: false,
  },
  jsPlugins: [
    require.resolve("eslint-plugin-compat"),
    {
      name: "vite-plus",
      specifier: "vite-plus/oxlint-plugin",
    },
  ],
  rules: {
    "compat/compat": "error",
    "vite-plus/prefer-vite-plus-imports": "error",
  },
  overrides: [
    {
      files: ["**/*.ts"],
      rules: {},
    },
    {
      files: ["storybook/**/*.tsx"],
      rules: {
        "explicit-function-return-type": "off",
        "no-explicit-any": "off",
        "no-unsafe-assignment": "off",
        "no-empty-function": "off",
      },
    },
    {
      jsPlugins: [
        require.resolve("eslint-plugin-solid"),
        require.resolve("@tanstack/eslint-plugin-query"),
      ],
      files: ["src/**/*.tsx"],
      rules: {
        "explicit-function-return-type": "off",
        "solid/components-return-once": "error",
        "solid/event-handlers": "error",
        "solid/imports": "error",
        "solid/jsx-no-duplicate-props": "error",
        "solid/jsx-no-script-url": "error",
        "solid/jsx-no-undef": "error",
        "solid/no-array-handlers": "error",
        "solid/no-destructure": "error",
        "solid/no-innerhtml": "error",
        "solid/no-react-deps": "error",
        "solid/no-react-specific-props": "error",
        "solid/no-unknown-namespaces": "error",
        "solid/prefer-classlist": "error",
        "solid/prefer-for": "error",
        "solid/prefer-show": "error",
        "solid/reactivity": "error",
        "solid/self-closing-comp": [
          "error",
          {
            html: "void",
          },
        ],
        "solid/style-prop": "error",
        "@tanstack/query/exhaustive-deps": "error",
        "@tanstack/query/no-rest-destructuring": "error",
        "@tanstack/query/stable-query-client": "error",
        "@tanstack/query/no-unstable-deps": "error",
        "@tanstack/query/infinite-query-property-order": "error",
        "@tanstack/query/no-void-query-fn": "error",
        "@tanstack/query/mutation-property-order": "error",
      },
    },
  ],
};
