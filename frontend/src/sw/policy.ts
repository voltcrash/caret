/**
 * Pure request/cache policy of the Start service worker. Kept separate from
 * the worker's event wiring so the rules are unit-tested and auditable.
 */

/** Build-time configuration embedded into `/sw.js`. */
export type ServiceWorkerConfig = {
  buildId: string;
  /** Same-origin URLs required for guest typing after one online visit. */
  precache: string[];
};

/** Offline document for `/`: a guest render, never a signed-in response. */
export const shellPath = "/";

const startCachePrefix = "oxytype-start-";

/** One cache per build: shell, precache and runtime-cached public files. */
export function buildCacheName(buildId: string): string {
  return `${startCachePrefix}${buildId}`;
}

export type Strategy =
  /** Not handled: the browser performs its normal network request. */
  | "bypass"
  /** Network only, never cached; offline falls back to shell/offline page. */
  | "navigate"
  /** Content-addressed file: cache first, any build's cache may answer. */
  | "immutable"
  /** Public unversioned file: cached copy first, refreshed in background. */
  | "static";

type RequestLike = { method: string; url: string; mode: string };

const neverIntercepted = new Set(["/sw.js", "/version.json", "/release.json"]);

const staticPrefixes = [
  "/themes/",
  "/webfonts/",
  "/webfonts-preview/",
  "/layouts/",
  "/languages/",
  "/funbox/",
  "/challenges/",
  "/sounds/",
  "/quotes/",
  "/images/",
];
const staticFiles = new Set(["/manifest.json", "/contributors.json"]);

// Rollback build names: `/js|css|webfonts/name.<8 char hash>.ext`.
const rollbackHashedAsset =
  /^\/(?:js|css|webfonts)\/[^/]+\.[\w-]{8}\.(?:js|css|woff2)$/;

/**
 * Generic runtime caching never sees auth, `/api`, server functions, mutations
 * or other origins. Start function paths live outside `/api`, so the former
 * catch-all NetworkFirst rule is intentionally not reproduced.
 */
export function classify(request: RequestLike, origin: string): Strategy {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== origin) return "bypass";
  const path = url.pathname;
  if (
    path === "/api" ||
    path.startsWith("/api/") ||
    path.startsWith("/_serverFn/") ||
    neverIntercepted.has(path)
  ) {
    return "bypass";
  }
  if (request.mode === "navigate") return "navigate";
  if (
    path.startsWith("/assets/") ||
    rollbackHashedAsset.test(path) ||
    (path.startsWith("/languages/") && url.searchParams.has("v"))
  ) {
    return "immutable";
  }
  if (staticFiles.has(path) || staticPrefixes.some((p) => path.startsWith(p))) {
    return "static";
  }
  return "bypass";
}

/** Only the typing route has an offline document; its search is client-parsed. */
export function servesShell(url: string): boolean {
  return new URL(url).pathname === shellPath;
}

const legacyCaches = [
  /^workbox-precache/,
  /^workbox-runtime/,
  /^oxytype-languages$/,
];
const legacyAssetCache = "oxytype-build-assets";

/**
 * Caches to delete when `buildId` activates. `names` is CacheStorage key order
 * (creation order). The previous Start build's cache survives one generation so
 * its open tabs can still load chunks they had cached. Rollback hashed assets
 * survive only the first Start activation, for tabs open across the cutover.
 */
export function obsoleteCaches(names: string[], buildId: string): string[] {
  const current = buildCacheName(buildId);
  const starts = names.filter(
    (name) => name.startsWith(startCachePrefix) && name !== current,
  );
  const previous = starts.at(-1);
  return names.filter((name) => {
    if (name === current || name === previous) return false;
    if (name.startsWith(startCachePrefix)) return true;
    if (name === legacyAssetCache) return previous !== undefined;
    return legacyCaches.some((pattern) => pattern.test(name));
  });
}

/**
 * Every replacement waits for the page to ask, including legacy workers and
 * installations whose caches were evicted. Only a first install activates itself.
 */
export function activatesImmediately(hasActiveWorker: boolean): boolean {
  return !hasActiveWorker;
}

/** Message a page posts to let a waiting worker take over. */
export const skipWaitingMessage = "oxytype:skip-waiting";
/** Waiting workers ask every open tab before taking over the shared scope. */
export const updateSafetyRequest = "oxytype:update-safety";

/** Script-free, user-independent fallback for documents other than `/`. */
export function offlinePage(stylesheets: string[]): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Offline | Oxytype</title>${stylesheets.map((href) => `<link rel="stylesheet" href="${href}">`).join("")}</head><body class="m-0 grid min-h-screen place-content-center gap-4 bg-bg p-8 text-center font-mono text-text"><h1>You're offline</h1><p>This page needs a connection. The typing test is available offline.</p><p><a class="text-main underline" href="/">Start typing</a></p></body></html>`;
}

export const offlinePageHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
};
