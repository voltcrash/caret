import { resolve } from "node:path";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";
import tailwindcss from "@tailwindcss/vite";
import { projects } from "../vitest.config";
import { fontStyles } from "../vite-plugins/font-styles";

const root = resolve(import.meta.dirname, "..");
const jsxFiles = [
  "__tests__/components/common/Button.spec.tsx",
  "__tests__/components/ui/Select.spec.tsx",
  "__tests__/hooks/useInputListener.spec.tsx",
];
const unitFiles = [
  "__tests__/utils/type-to-search.spec.ts",
  "__tests__/utils/local-storage-with-schema.spec.ts",
];
const jsx = projects.find((project) =>
  project.test.include.includes("__tests__/**/*.spec.tsx"),
);
const unit = projects.find(
  (project) => project.test.environment === "happy-dom",
);
if (jsx === undefined || unit === undefined) {
  throw new Error("Browser pilot requires the existing JSX and unit projects");
}

// Opt-in comparison only. The regular frontend test projects stay unchanged.
export default defineConfig({
  test: {
    clearMocks: false,
    sharedViteServer: false,
    fileParallelism: false,
    maxWorkers: 1,
    projects: [
      {
        ...jsx,
        test: {
          ...jsx.test,
          root,
          name: "pilot-jsdom",
          include: jsxFiles,
        },
      },
      {
        ...unit,
        test: {
          ...unit.test,
          root,
          name: "pilot-happy-dom",
          include: unitFiles,
        },
      },
      {
        plugins: [...(jsx.plugins ?? []), fontStyles(), tailwindcss()],
        define: jsx.define,
        test: {
          root,
          name: "pilot-browser",
          include: [
            ...jsxFiles,
            ...unitFiles,
            "__tests__/browser-pilot/native.browser.tsx",
          ],
          setupFiles: [
            "__tests__/browser-pilot/setup.ts",
            "__tests__/__harness__/mock-application.ts",
            "__tests__/__harness__/mock-dom.ts",
            "__tests__/__harness__/mock-auth.ts",
          ],
          globals: true,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
