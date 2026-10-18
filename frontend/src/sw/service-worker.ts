/**
 * Start service worker, built by vite-plugins/service-worker.ts into `/sw.js`
 * with this build's ID and precache list. Request rules live in ./policy.
 */
import {
  activatesImmediately,
  buildCacheName,
  classify,
  obsoleteCaches,
  offlinePage,
  offlinePageHeaders,
  servesShell,
  shellPath,
  skipWaitingMessage,
  updateSafetyRequest,
  type ServiceWorkerConfig,
  type Strategy,
} from "./policy";

declare const __OXYTYPE_SW__: ServiceWorkerConfig;

// The DOM lib types `self` as a Window; declare the worker surface used here.
type ExtendableEvent = Event & { waitUntil: (work: Promise<unknown>) => void };
type FetchEvent = ExtendableEvent & {
  request: Request;
  preloadResponse: Promise<Response | undefined>;
  respondWith: (response: Promise<Response>) => void;
};
type MessageEvent = ExtendableEvent & { data: unknown };
type WorkerScope = {
  location: Location;
  registration: ServiceWorkerRegistration & {
    navigationPreload?: { enable: () => Promise<void> };
  };
  clients: {
    claim: () => Promise<void>;
    matchAll: (options: {
      type: "window";
      includeUncontrolled: boolean;
    }) => Promise<
      { postMessage: (message: string, transfer: MessagePort[]) => void }[]
    >;
  };
  skipWaiting: () => Promise<void>;
  addEventListener: ((
    type: "install" | "activate",
    listener: (event: ExtendableEvent) => void,
  ) => void) &
    ((type: "fetch", listener: (event: FetchEvent) => void) => void) &
    ((type: "message", listener: (event: MessageEvent) => void) => void);
};

const worker = globalThis as unknown as WorkerScope;
const config = __OXYTYPE_SW__;
const cacheName = buildCacheName(config.buildId);
const origin = worker.location.origin;

async function precache(): Promise<void> {
  const immediate = activatesImmediately(worker.registration.active !== null);
  const cache = await caches.open(cacheName);
  await Promise.all(
    config.precache.map(async (path) => {
      const url = new URL(path, origin).href;
      const immutable =
        classify({ method: "GET", url, mode: "cors" }, origin) === "immutable";
      // Content-addressed files come from a previous build's cache or the
      // HTTP cache when possible; public static files are revalidated.
      const response =
        (immutable ? await caches.match(url) : undefined) ??
        (await fetch(url, { cache: immutable ? "default" : "no-cache" }));
      if (!response.ok) throw new Error(`Precache failed: ${path}`);
      await cache.put(url, response);
    }),
  );
  // Credentials are omitted: the shell is always the guest render.
  const shell = await fetch(shellPath, {
    credentials: "omit",
    cache: "no-store",
    headers: { Accept: "text/html" },
  });
  if (!shell.ok || shell.headers.get("X-Oxytype-Build") !== config.buildId) {
    // Mid-deployment mismatch: fail install; the browser retries later.
    throw new Error("Offline shell does not belong to this build");
  }
  await cache.put(new URL(shellPath, origin).href, shell);
  if (immediate) await worker.skipWaiting();
}

async function activate(): Promise<void> {
  const names = await caches.keys();
  await Promise.all(
    obsoleteCaches(names, config.buildId).map(
      async (name) => await caches.delete(name),
    ),
  );
  await worker.registration.navigationPreload?.enable();
  await worker.clients.claim();
}

async function offlineDocument(url: string): Promise<Response> {
  if (servesShell(url)) {
    const cache = await caches.open(cacheName);
    const shell = await cache.match(new URL(shellPath, origin).href);
    if (shell !== undefined) return shell;
  }
  return new Response(
    offlinePage(config.precache.filter((path) => path.endsWith(".css"))),
    {
      status: 503,
      headers: offlinePageHeaders,
    },
  );
}

async function store(request: Request, response: Response): Promise<void> {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
}

async function respond(
  event: FetchEvent,
  strategy: Strategy,
): Promise<Response> {
  const { request } = event;
  if (strategy === "navigate") {
    try {
      return (await event.preloadResponse) ?? (await fetch(request));
    } catch {
      return await offlineDocument(request.url);
    }
  }
  if (strategy === "immutable") {
    const cached = await caches.match(request);
    if (cached !== undefined) return cached;
    const response = await fetch(request);
    if (response.status === 200) {
      event.waitUntil(store(request, response.clone()));
    }
    return response;
  }
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const refresh = fetch(request).then(async (response) => {
    if (response.status === 200) await cache.put(request, response.clone());
    return response;
  });
  if (cached === undefined) return await refresh;
  event.waitUntil(refresh.catch(() => undefined));
  return cached;
}

worker.addEventListener("install", (event) => {
  event.waitUntil(precache());
});

worker.addEventListener("activate", (event) => {
  event.waitUntil(activate());
});

async function activateWhenTabsAreSafe(): Promise<void> {
  const tabs = await worker.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  const safe = await Promise.all(
    tabs.map(
      async (tab) =>
        await new Promise<boolean>((resolve) => {
          const channel = new MessageChannel();
          const finish = (safe: boolean): void => {
            clearTimeout(timeout);
            channel.port1.close();
            resolve(safe);
          };
          // Unknown/legacy/frozen tabs are conservative: close or refresh them first.
          const timeout = setTimeout(() => finish(false), 1000);
          channel.port1.onmessage = (event) => finish(event.data === true);
          tab.postMessage(updateSafetyRequest, [channel.port2]);
        }),
    ),
  );
  if (safe.every(Boolean)) await worker.skipWaiting();
}

worker.addEventListener("message", (event) => {
  if (event.data === skipWaitingMessage) {
    event.waitUntil(activateWhenTabsAreSafe());
  }
});

worker.addEventListener("fetch", (event) => {
  // Media range requests and other partial reads stay with the browser.
  if (event.request.headers.has("range")) return;
  const strategy = classify(event.request, origin);
  if (strategy === "bypass") return;
  event.respondWith(respond(event, strategy));
});
