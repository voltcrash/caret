import { resolve } from "node:path";
import { build, type Plugin } from "vite-plus";
import type { ServiceWorkerConfig } from "../src/sw/policy";

type ChunkInfo = {
  fileName: string;
  isEntry: boolean;
  facadeModuleId: string | null;
  imports: string[];
  dynamicImports: string[];
  viteMetadata?: { importedCss: Set<string> };
};
type BundleInfo = Record<
  string,
  ({ type: "chunk" } & ChunkInfo) | { type: "asset"; fileName: string }
>;

const routeSplit = /\/src\/routes\/([^?]+)\.tsx\?tsr-split=/;

/** Route files whose split components render the typing page. */
const shellRoutes = new Set(["_app", "_app.index"]);

/**
 * Client modules (and their imports) loaded by guest typing: browser runtime,
 * chrome, the typing leaf, its result screen and the typing modals. Paths are
 * repository-relative; a missing module fails the build instead of silently
 * dropping offline support.
 */
const offlineTypingModules = [
  "src/app/browser-runtime.client.tsx",
  "src/app/chrome.client.tsx",
  "src/features/typing/page.client.tsx",
  "src/features/typing/components/result/Result.tsx",
  "src/ts/components/modals/Commandline.tsx",
  "src/ts/components/modals/CustomTextModal.tsx",
  "src/ts/components/modals/CustomTestDurationModal.tsx",
  "src/ts/components/modals/CustomWordAmountModal.tsx",
  "src/ts/components/modals/QuoteSearchModal.tsx",
  "src/ts/components/modals/CookiesModal.tsx",
];

function moduleOf(facade: string | null): string | undefined {
  if (facade === null) return undefined;
  const index = facade.lastIndexOf("/frontend/");
  return index < 0 ? undefined : facade.slice(index + "/frontend/".length);
}

/**
 * Same-origin files guest typing needs offline: the client entry, the typing
 * route, the declared typing modules, everything they statically import and
 * their CSS. Other pages' chunks are cached only when visited online.
 */
export function precacheFromBundle(
  bundle: BundleInfo,
  modules: readonly string[] = offlineTypingModules,
): string[] {
  const chunks = new Map<string, ChunkInfo>();
  for (const output of Object.values(bundle)) {
    if (output.type === "chunk") chunks.set(output.fileName, output);
  }
  const roots: string[] = [];
  const found = new Set<string>();
  for (const chunk of chunks.values()) {
    const route = routeSplit.exec(chunk.facadeModuleId ?? "")?.[1];
    const module = moduleOf(chunk.facadeModuleId);
    if (chunk.isEntry || (route !== undefined && shellRoutes.has(route))) {
      roots.push(chunk.fileName);
    }
    if (module !== undefined && modules.includes(module)) {
      roots.push(chunk.fileName);
      found.add(module);
    }
  }
  const missing = modules.filter((module) => !found.has(module));
  if (missing.length > 0) {
    throw new Error(
      `Offline typing modules are not separate client chunks: ${missing.join(", ")}`,
    );
  }
  const files = new Set<string>();
  const pending = [...roots];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (files.has(file)) continue;
    const chunk = chunks.get(file);
    if (chunk === undefined) continue;
    files.add(file);
    for (const css of chunk.viteMetadata?.importedCss ?? []) files.add(css);
    pending.push(...chunk.imports);
  }
  for (const output of Object.values(bundle)) {
    // Document CSS is linked by URL from the root route, not imported.
    if (output.type === "asset" && /\.(?:css|woff2)$/.test(output.fileName)) {
      files.add(output.fileName);
    }
  }
  return [...files].sort().map((file) => `/${file}`);
}

/** Public files the default typing configuration reads at startup. */
export function offlineStaticFiles(englishHash: string): string[] {
  return [
    `/languages/english.json?v=${englishHash.slice(0, 16)}`,
    "/webfonts/RobotoMono-Regular.woff2",
    "/webfonts/LexendDeca-Regular.woff2",
    "/manifest.json",
    "/images/favicon/oxytype.svg",
  ];
}

/**
 * Builds `/sw.js` after the client bundle: a self-contained script whose
 * embedded build ID and precache list match this exact build's output.
 */
export function startServiceWorker(options: {
  buildId: string;
  englishHash: () => string;
}): Plugin {
  let precache: string[] = [];
  let outDir = "";
  return {
    name: "oxytype-service-worker",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    generateBundle(_options, bundle) {
      outDir = this.environment.config.build.outDir;
      precache = [
        ...precacheFromBundle(bundle),
        ...offlineStaticFiles(options.englishHash()),
      ];
    },
    async closeBundle() {
      // Vite may close a config-only/test environment without generating a
      // client bundle. Never emit an empty worker into the workspace root.
      if (outDir === "") return;
      const config: ServiceWorkerConfig = {
        buildId: options.buildId,
        precache,
      };
      await build({
        configFile: false,
        logLevel: "warn",
        publicDir: false,
        root: resolve(import.meta.dirname, ".."),
        build: {
          outDir,
          emptyOutDir: false,
          copyPublicDir: false,
          minify: true,
          sourcemap: false,
          rolldownOptions: {
            input: resolve(import.meta.dirname, "../src/sw/service-worker.ts"),
            output: {
              format: "iife",
              entryFileNames: "sw.js",
              // This build's configuration, read by the worker as a global.
              banner: `var __OXYTYPE_SW__ = ${JSON.stringify(config)};`,
            },
          },
        },
      });
    },
  };
}
