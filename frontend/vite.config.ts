import { defineConfig } from "vite-plus";
import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { frontendLint } from "./lint.config";

export default defineConfig(({ mode }) => ({
  lint: { ...frontendLint },
  publicDir: "static",
  envPrefix: "OXYTYPE_PUBLIC_",
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
      viteEnvironment: { name: "ssr" },
      persistState: { path: "../backend/.wrangler/state" },
    }),
    tanstackStart({
      server: { entry: "worker.ts" },
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
    tailwindcss(),
  ],
  define: {
    "import.meta.env.OXYTYPE_OFFLINE": JSON.stringify(mode === "offline"),
  },
  build: { outDir: "dist/start" },
  server: { port: 3000, strictPort: true },
  clearScreen: false,
}));
