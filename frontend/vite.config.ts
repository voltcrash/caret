import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { frontendLint } from "./lint.config";
import { fontStyles } from "./vite-plugins/font-styles";

export default defineConfig(({ mode }) => ({
  lint: { ...frontendLint },
  publicDir: "static",
  envPrefix: [],
  resolve: {
    dedupe: ["solid-js", "@tanstack/solid-router", "@tanstack/solid-query"],
  },
  ssr: { noExternal: ["solid-js", "@tanstack/solid-router", "@solidjs/meta"] },
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
          files: ["**/backend/src/**"],
        },
        server: {
          files: [
            "**/frontend/src/ts/index.ts",
            "**/frontend/src/ts/test/**",
            "**/*.client.ts",
          ],
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
  build: { outDir: mode === "runtime-test" ? "dist/start-test" : "dist/start" },
  server: { port: 3000, strictPort: true },
  clearScreen: false,
}));
