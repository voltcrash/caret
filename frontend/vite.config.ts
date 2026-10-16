import { envConfig } from "./vite-plugins/env-config";
import { languageHash, languageHashes } from "./vite-plugins/language-hashes";
import { resolveBuildId, startVersionFile } from "./vite-plugins/build-id";
import { defineConfig, loadEnv } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { frontendLint } from "./lint.config";
import { fontStyles } from "./vite-plugins/font-styles";
import { workerNodeBuiltins } from "./vite-plugins/worker-node-builtins";
import { apiDocs } from "./vite-plugins/api-docs";
import { startWebManifest } from "./vite-plugins/web-manifest";
import { startServiceWorker } from "./vite-plugins/service-worker";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import {
  clientOnlyFeatureFiles,
  rollbackOnlyFiles,
  ssrSafeLegacyFiles,
} from "./vite-plugins/import-boundaries";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const buildId = resolveBuildId(mode !== "production");
  const sentryDsn = env["SENTRY_DSN"] ?? "";
  const sentryOrigin = sentryDsn === "" ? "" : new URL(sentryDsn).origin;
  if (sentryOrigin !== "" && !sentryOrigin.startsWith("https://")) {
    throw new Error("SENTRY_DSN must use HTTPS");
  }
  const deployment = process.env["OXYTYPE_DEPLOY_ENV"];
  if (
    deployment !== undefined &&
    deployment !== "production" &&
    deployment !== "staging"
  ) {
    throw new Error("OXYTYPE_DEPLOY_ENV must be production or staging");
  }
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
        build: { minify: true, sourcemap: true },
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
      apiDocs(),
      startWebManifest(),
      startVersionFile(buildId),
      startServiceWorker({
        buildId,
        englishHash: () => languageHash("english"),
      }),
      envConfig({
        isDevelopment: mode !== "production",
        clientVersion: buildId,
        env: {
          BACKEND_URL: "/api",
          AUTH_PROVIDERS: env["AUTH_PROVIDERS"] ?? "google,github",
          TURNSTILE_SITE_KEY: env["TURNSTILE_SITE_KEY"] ?? "",
          SENTRY_DSN: env["SENTRY_DSN"] ?? "",
          DEV_OFFLINE: mode === "offline" ? "true" : "false",
        },
      }),
      languageHashes({ skip: false }),
      cloudflare({
        configPath:
          deployment === undefined
            ? "wrangler.jsonc"
            : `wrangler.${deployment}.json`,
        config: (config) => ({
          ...(mode === "runtime-test"
            ? { main: "__tests__/start/worker-entry.ts" }
            : {}),
          vars: { ...config.vars, VERSION: buildId },
        }),
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
      ...(sentryDsn === ""
        ? []
        : sentryVitePlugin({
            authToken: env["SENTRY_AUTH_TOKEN"],
            org: env["SENTRY_ORG"],
            project: env["SENTRY_PROJECT"],
            release: { name: buildId },
            applicationKey: "oxytype-frontend",
            telemetry: false,
            sourcemaps: { disable: (env["SENTRY_AUTH_TOKEN"] ?? "") === "" },
          }).map((plugin) => ({
            ...plugin,
            applyToEnvironment: (environment: { name: string }) =>
              environment.name === "client",
          }))),
    ],
    define: {
      "import.meta.env.OXYTYPE_OFFLINE": JSON.stringify(mode === "offline"),
      // Client and Worker share it; logs and error reports join on this ID.
      "import.meta.env.OXYTYPE_BUILD_ID": JSON.stringify(buildId),
      "import.meta.env.OXYTYPE_SENTRY_ORIGIN": JSON.stringify(sentryOrigin),
    },
    build: {
      outDir: mode === "runtime-test" ? "dist/start-test" : "dist/start",
    },
    server: { port: 3000, strictPort: true },
    clearScreen: false,
  };
});
