import { frontendLint } from "./lint.config";
import {
  defineConfig,
  loadEnv,
  UserConfig,
  BuildEnvironmentOptions,
  PluginOption,
  CSSOptions,
} from "vite-plus";
import path from "node:path";
import injectHTML from "vite-plugin-html-inject";
import { fontStyles } from "./vite-plugins/font-styles";
import { getClientVersion } from "./vite-plugins/client-version";
import { envConfig } from "./vite-plugins/env-config";
import { languageHashes } from "./vite-plugins/language-hashes";
import { standaloneHtml } from "./vite-plugins/standalone-html";
import { devtoolsEntry } from "./vite-plugins/devtools-entry";
import { rollbackOperationTransport } from "./vite-plugins/rollback-operations";
import { webManifest } from "./vite-plugins/web-manifest";
import solidPlugin from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";

async function getPlugins({
  isDevelopment,
  env,
  useSentry,
}: {
  isDevelopment: boolean;
  env: Record<string, string>;
  useSentry: boolean;
}): Promise<PluginOption[]> {
  const clientVersion = getClientVersion(isDevelopment);

  const plugins: PluginOption[] = [
    rollbackOperationTransport(),
    envConfig({ isDevelopment, clientVersion, env }),
    devtoolsEntry({ enabled: isDevelopment && env["DEV_TOOLS"] === "true" }),
    languageHashes({ skip: isDevelopment }),
    injectHTML() as PluginOption,
    fontStyles({ isDevelopment }),
    tailwindcss(),

    solidPlugin({ ssr: true }),
    standaloneHtml(),
  ];

  if (isDevelopment) {
    if (env["DEV_TOOLS"] === "true") {
      const { default: devtools } = await import("solid-devtools/vite");
      plugins.push(devtools({ autoname: true }));
    }
    if (env["DEV_LINT"] === "true" || env["DEV_LINT"] === "fast") {
      const { oxlintChecker } = await import("./vite-plugins/oxlint-checker");
      plugins.push(
        oxlintChecker({
          debounceDelay: 750,
          typeAware: env["DEV_LINT"] === "true",
          overlay: true,
        }),
      );
    }
    if (env["DEV_INSPECT"] === "true") {
      const { default: Inspect } = await import("vite-plugin-inspect");
      plugins.push(Inspect());
    }
    return plugins;
  }

  const [
    { fontPreview },
    { fontawesomeSubset },
    { versionFile },
    { ViteMinifyPlugin },
    { VitePWA },
    { injectPreload },
    { minifyJson },
  ] = await Promise.all([
    import("./vite-plugins/font-preview"),
    import("./vite-plugins/fontawesome-subset"),
    import("./vite-plugins/version-file"),
    import("vite-plugin-minify"),
    import("vite-plugin-pwa"),
    import("./vite-plugins/inject-preload"),
    import("./vite-plugins/minify-json"),
  ]);

  const prodPlugins: PluginOption[] = [
    fontPreview(),
    fontawesomeSubset(),
    versionFile({ clientVersion }),
    ViteMinifyPlugin(),
    VitePWA({
      // injectRegister: "networkfirst",
      injectRegister: null,
      registerType: "autoUpdate",
      manifest: structuredClone(webManifest),
      manifestFilename: "manifest.json",
      workbox: {
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globIgnores: ["**/.*"],
        globPatterns: [],
        navigateFallback: "",
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              ["/version.json", "/release.json"].includes(url.pathname),
            handler: "NetworkOnly",
          },
          {
            // Content hashes change on deploy, so cached build assets stay valid.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              /^\/(?:js|css|webfonts)\/[^/]+\.[\w-]{8}\.(?:js|css|woff2)$/.test(
                url.pathname,
              ),
            handler: "CacheFirst",
            options: {
              cacheName: "oxytype-build-assets",
              expiration: { maxEntries: 128, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            // Language URLs carry their content hash, see getLanguageUrl.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              url.pathname.startsWith("/languages/") &&
              url.searchParams.has("v"),
            handler: "CacheFirst",
            options: {
              cacheName: "oxytype-languages",
              expiration: { maxEntries: 8, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: (options) => {
              const isApi =
                options.url.pathname === "/api" ||
                options.url.pathname.startsWith("/api/");
              return options.sameOrigin && !isApi;
            },
            handler: "NetworkFirst",
            options: {},
          },
        ],
      },
    }),
    useSentry
      ? (await import("@sentry/vite-plugin")).sentryVitePlugin({
          authToken: env["SENTRY_AUTH_TOKEN"],
          org: env["SENTRY_ORG"],
          project: env["SENTRY_PROJECT"],
          release: {
            name: clientVersion,
          },
          applicationKey: "oxytype-frontend",
        })
      : null,
    injectPreload(),
    minifyJson(),
  ];

  return [...plugins, ...prodPlugins].filter((it) => it !== null);
}

function getBuildOptions({
  enableSourceMaps,
}: {
  enableSourceMaps: boolean;
}): BuildEnvironmentOptions {
  return {
    sourcemap: enableSourceMaps,
    emptyOutDir: true,
    outDir: "../dist",
    assetsInlineLimit: 0, //dont inline small files as data
    rolldownOptions: {
      input: {
        oxytype: path.resolve(__dirname, "src/index.html"),
        oauth: path.resolve(__dirname, "src/oauth-callback.html"),
        privacy: path.resolve(__dirname, "src/privacy-policy.html"),
        404: path.resolve(__dirname, "src/404.html"),
      },
      output: {
        assetFileNames: (assetInfo) => {
          let extType = (assetInfo.names[0] as string).split(".").at(1);

          if (extType === undefined) {
            throw new Error(
              `Could not determine asset type for asset: ${assetInfo.names[0]}`,
            );
          }

          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            extType = "images";
          }
          if (
            /\.(woff|woff2|eot|ttf|otf)$/.test(assetInfo.names[0] as string)
          ) {
            return `webfonts/[name].[hash].${extType}`;
          }
          // oxlint-disable-next-line no-deprecated -- Keep the existing vendor CSS naming contract while the legacy asset name is supported.
          if (assetInfo.name === "misc.css") {
            return `${extType}/vendor.[hash][extname]`;
          }

          return `${extType}/[name].[hash][extname]`;
        },
        chunkFileNames: "js/[name].[hash].js",
        entryFileNames: "js/[name].[hash].js",
        codeSplitting: {
          groups: [
            {
              name: "app-owners",
              test: /src\/app\/(?:application|account-data|account-scope|scope|state|readiness|query-client)\.ts$/,
            },
            {
              name: "vendor-sentry",
              test: /node_modules\/@sentry\//,
            },
            {
              name: "vendor-auth",
              test: /node_modules\/(?:@better-auth|better-auth|better-call|@better-fetch)\//,
            },
          ],
        },
      },
    },
  };
}

function getCssOptions(env: Record<string, string>): CSSOptions {
  return {
    devSourcemap: env["DEV_CSS_SOURCEMAPS"] === "true",
  };
}

export default defineConfig(async ({ mode }): Promise<UserConfig> => {
  const env = loadEnv(mode, process.cwd(), "");
  const useSentry = Boolean(env["SENTRY_AUTH_TOKEN"]);
  const isDevelopment = mode !== "production";

  if (!isDevelopment) {
    if (
      env["TURNSTILE_SITE_KEY"] === undefined ||
      env["TURNSTILE_SITE_KEY"] === ""
    ) {
      throw new Error(`${mode}: TURNSTILE_SITE_KEY is not defined`);
    }
    if (
      useSentry &&
      (env["SENTRY_ORG"] === undefined ||
        env["SENTRY_ORG"] === "" ||
        env["SENTRY_PROJECT"] === undefined ||
        env["SENTRY_PROJECT"] === "")
    ) {
      throw new Error(
        `${mode}: SENTRY_ORG and SENTRY_PROJECT are required for source map uploads`,
      );
    }
  }

  return {
    lint: { ...frontendLint },
    plugins: await getPlugins({ isDevelopment, useSentry: useSentry, env }),
    build: getBuildOptions({ enableSourceMaps: useSentry }),
    css: getCssOptions(env),
    server: {
      open: env["SERVER_OPEN"] === "true",
      port: 3000,
      host: env["BACKEND_URL"] !== undefined,
      watch: {
        //we rebuild the whole contracts package when a file changes
        //so we only want to watch one file
        ignored: [/.*\/packages\/contracts\/dist\/(?!configs).*/],
      },
    },
    clearScreen: false,
    root: "src",
    publicDir: "../static",
    optimizeDeps: {
      exclude: ["@fortawesome/fontawesome-free"],
    },
  };
});
