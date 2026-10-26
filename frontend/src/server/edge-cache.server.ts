import "@tanstack/solid-start/server-only";
import type { ExecutionContext } from "@cloudflare/workers-types";

/**
 * Location-local Cache API for public reads. Only operations listed in the
 * backend's `EDGE_CACHE_SECONDS` mark their responses with `s-maxage`; the
 * Worker stores those. Lookups run as request middleware after the CSRF
 * check, so hits keep its origin rules but skip rate limits, sessions and
 * D1. Inert on workers.dev hosts.
 */
const CACHE_NAME = "public-reads";
const CACHEABLE_PATHS = ["/api/", "/_serverFn/"];
// Per-client or per-request values never enter the shared copy.
const PRIVATE_HEADERS = [
  "Retry-After",
  "X-RateLimit-Limit",
  "X-Request-Id",
  "Set-Cookie",
];

export function edgeCacheKey(request: Request): Request | undefined {
  if (request.method !== "GET" || typeof caches === "undefined") {
    return undefined;
  }
  const url = new URL(request.url);
  if (!CACHEABLE_PATHS.some((path) => url.pathname.startsWith(path))) {
    return undefined;
  }
  if (/\bno-cache\b/i.test(request.headers.get("cache-control") ?? "")) {
    return undefined;
  }
  return new Request(url.toString(), { method: "GET" });
}

export const EDGE_CACHE_HIT = "X-Caret-Cache";

export async function matchEdgeCache(
  request: Request,
): Promise<Response | undefined> {
  const key = edgeCacheKey(request);
  if (key === undefined) return undefined;
  let hit: Response | undefined;
  try {
    hit = await (await caches.open(CACHE_NAME)).match(key);
  } catch {
    return undefined;
  }
  if (hit === undefined) return undefined;
  const etag = hit.headers.get("ETag");
  const match = request.headers.get("if-none-match");
  const strip = (tag: string): string => tag.trim().replace(/^W\//, "");
  const fresh =
    etag !== null &&
    match
      ?.split(",")
      .some((tag) => tag.trim() === "*" || strip(tag) === strip(etag)) === true;
  const response = fresh
    ? new Response(null, { status: 304, headers: hit.headers })
    : new Response(hit.body, hit);
  response.headers.set(EDGE_CACHE_HIT, "hit");
  return response;
}

export function storeEdgeCache(
  key: Request,
  response: Response,
  execution: Pick<ExecutionContext, "waitUntil">,
): void {
  if (
    response.status !== 200 ||
    response.headers.has(EDGE_CACHE_HIT) ||
    response.headers.has("Set-Cookie") ||
    !/\bs-maxage=\d+/.test(response.headers.get("Cache-Control") ?? "")
  ) {
    return;
  }
  const copy = new Response(response.clone().body, response);
  for (const name of PRIVATE_HEADERS) copy.headers.delete(name);
  execution.waitUntil(
    (async () => {
      try {
        await (await caches.open(CACHE_NAME)).put(key, copy);
      } catch (error) {
        console.error("Edge cache write failed", error);
      }
    })(),
  );
}
