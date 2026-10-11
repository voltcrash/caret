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
import childProcess from "child_process";
import { fontStyles } from "./vite-plugins/font-styles";
import { fontawesomeSubset } from "./vite-plugins/fontawesome-subset";
import { fontPreview } from "./vite-plugins/font-preview";
import { envConfig } from "./vite-plugins/env-config";
import { languageHashes } from "./vite-plugins/language-hashes";
import { minifyJson } from "./vite-plugins/minify-json";
import { versionFile } from "./vite-plugins/version-file";
import { oxlintChecker } from "./vite-plugins/oxlint-checker";
import { injectPreload } from "./vite-plugins/inject-preload";
import { standaloneHtml } from "./vite-plugins/standalone-html";
import Inspect from "vite-plugin-inspect";
import { ViteMinifyPlugin } from "vite-plugin-minify";
import { VitePWA } from "vite-plugin-pwa";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import solidPlugin from "vite-plugin-solid";
import devtools from "solid-devtools/vite";
import tailwindcss from "@tailwindcss/vite";

function pad(
  numbers: number[],
  maxLength: number,
  fillString: string,
): string[] {
  return numbers.map((number) =>
    number.toString().padStart(maxLength, fillString),
  );
}

function getClientVersion(isDevelopment: boolean): string {
  if (isDevelopment) {
    return "DEVELOPMENT_CLIENT";
  }
  const date = new Date();
  const versionPrefix = pad(
    [date.getFullYear(), date.getMonth() + 1, date.getDate()],
    2,
    "0",
  ).join(".");
  const versionSuffix = pad([date.getHours(), date.getMinutes()], 2, "0").join(
    ".",
  );
  const version = [versionPrefix, versionSuffix].join("_");

  try {
    const commitHash = childProcess
      .execSync("git rev-parse --short HEAD")
      .toString();

    return `${version}_${commitHash}`.replace(/\n/g, "");
  } catch (e) {
    return `${version}_unknown-hash`;
  }
}

function getPlugins({
  isDevelopment,
  env,
  useSentry,
}: {
  isDevelopment: boolean;
  env: Record<string, string>;
  useSentry: boolean;
}): PluginOption[] {
  const clientVersion = getClientVersion(isDevelopment);

  const plugins: PluginOption[] = [
    envConfig({ isDevelopment, clientVersion, env }),
    languageHashes({ skip: isDevelopment }),
    injectHTML() as PluginOption,
    fontStyles({ isDevelopment }),
    tailwindcss(),

    solidPlugin({ ssr: true }),
    standaloneHtml(),
    devtools({
      autoname: true,
    }),
  ];

  const devPlugins: PluginOption[] = [
    oxlintChecker({
      debounceDelay: 125,
      typeAware: true,
      overlay: isDevelopment,
    }),
    Inspect(),
  ];

  const prodPlugins: PluginOption[] = [
    fontPreview(),
    fontawesomeSubset(),
    versionFile({ clientVersion }),
    ViteMinifyPlugin(),
    VitePWA({
      // injectRegister: "networkfirst",
      injectRegister: null,
      registerType: "autoUpdate",
      manifest: {
        id: "/",
        short_name: "Oxytype",
        name: "Oxytype",
        description: "A minimalistic, customizable typing test",
        start_url: "/",
        scope: "/",
        orientation: "any",
        categories: ["education", "productivity"],
        icons: [
          {
            src: "/images/icons/oxytype-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/images/icons/oxytype-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
        background_color: "#323437",
        display: "standalone",
        theme_color: "#323437",
      },
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
      ? sentryVitePlugin({
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

  return [...plugins, ...(isDevelopment ? devPlugins : prodPlugins)].filter(
    (it) => it !== null,
  );
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
          // oxlint-disable-next-line no-deprecated
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

function getCssOptions(): CSSOptions {
  return {
    devSourcemap: true,
  };
}

export default defineConfig(({ mode }): UserConfig => {
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
    plugins: getPlugins({ isDevelopment, useSentry: useSentry, env }),
    build: getBuildOptions({ enableSourceMaps: useSentry }),
    css: getCssOptions(),
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
