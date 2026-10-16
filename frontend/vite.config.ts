import { envConfig } from "./vite-plugins/env-config";
import { languageHashes } from "./vite-plugins/language-hashes";
import { getClientVersion } from "./vite-plugins/client-version";
import { defineConfig, loadEnv } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { frontendLint } from "./lint.config";
import { fontStyles } from "./vite-plugins/font-styles";
import { workerNodeBuiltins } from "./vite-plugins/worker-node-builtins";
import {
  clientOnlyFeatureFiles,
  rollbackOnlyFiles,
  ssrSafeLegacyFiles,
} from "./vite-plugins/import-boundaries";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    lint: { ...frontendLint },
    publicDir: "static",
    envPrefix: [],
    resolve: {
      dedupe: ["solid-js", "@tanstack/solid-router", "@tanstack/solid-query"],
    },
    ssr: {
      noExternal: ["solid-js", "@tanstack/solid-router", "@solidjs/meta"],
    },
    environments: {
      ssr: {
        optimizeDeps: {
          exclude: [
            "solid-js",
            "solid-js/web",
            "solid-js/store",
            "@tanstack/solid-router",
            "@tanstack/solid-query",
            "@tanstack/solid-router-ssr-query",
            "@solidjs/meta",
          ],
        },
      },
    },
    plugins: [
      workerNodeBuiltins(),
      envConfig({
        isDevelopment: mode !== "production",
        clientVersion: getClientVersion(mode !== "production"),
        env: {
          BACKEND_URL: "/api",
          AUTH_PROVIDERS: env["AUTH_PROVIDERS"] ?? "google,github",
          TURNSTILE_SITE_KEY: env["TURNSTILE_SITE_KEY"] ?? "",
          DEV_OFFLINE: mode === "offline" ? "true" : "false",
        },
      }),
      languageHashes({ skip: false }),
      cloudflare({
        configPath: "wrangler.jsonc",
        config:
          mode === "runtime-test"
            ? { main: "__tests__/start/worker-entry.ts" }
            : undefined,
        viteEnvironment: { name: "ssr" },
        persistState: { path: "../backend/.wrangler/state" },
      }),
      tanstackStart({
        server: {
          entry:
            mode === "runtime-test"
              ? "../__tests__/start/worker-entry.ts"
              : "worker.ts",
        },
        importProtection: {
          behavior: "error",
          client: {
            specifiers: [/^@oxytype\/backend/],
            // User file lists replace Start's defaults; keep `.server` denied.
            files: ["**/backend/src/**", "**/*.server.*", ...rollbackOnlyFiles],
          },
          // Legacy modules are browser state unless explicitly SSR-safe.
          // Patterns match root-relative paths.
          server: {
            files: ["src/ts/**", "**/*.client.*", ...clientOnlyFeatureFiles],
            excludeFiles: ["**/node_modules/**", ...ssrSafeLegacyFiles],
          },
        },
      }),
      solid({ ssr: true }),
      // Existing full font assets; rollback subset generation remains independent.
      fontStyles({ isDevelopment: true }),
      tailwindcss(),
    ],
    define: {
      "import.meta.env.OXYTYPE_OFFLINE": JSON.stringify(mode === "offline"),
    },
    build: {
      outDir: mode === "runtime-test" ? "dist/start-test" : "dist/start",
    },
    server: { port: 3000, strictPort: true },
    clearScreen: false,
  };
});
