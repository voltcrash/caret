import "@tanstack/solid-start/server-only";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { runtime } from "@caret/backend/runtime";

/**
 * Location-local Cache API for public reads. Only operations listed in the
 * backend's `EDGE_CACHE_SECONDS` mark their responses with `s-maxage`; the
 * Worker stores those. Lookups run as request middleware after the CSRF
 * check, so hits keep its origin rules but skip rate limits, sessions and
 * PostgreSQL. Inert on workers.dev hosts.
 */
const CACHE_NAME = "public-reads";
const CACHEABLE_PATHS = ["/api/", "/_serverFn/"];
// Per-client or per-request values never enter the shared copy.
const PRIVATE_HEADERS = [
  "Access-Control-Allow-Origin",
  "Retry-After",
  "X-RateLimit-Limit",
  "X-Request-Id",
  "Set-Cookie",
];
const ENTITY_HEADERS = [
  "Content-Type",
  "Content-Length",
  "Transfer-Encoding",
  "Content-Range",
];

function allowedCorsOrigin(): string | undefined {
  try {
    const { env } = runtime();
    const frontendUrl =
      env.MODE === "dev"
        ? (env.FRONTEND_URL ?? "http://localhost:3000")
        : env.FRONTEND_URL;
    if (frontendUrl === undefined || frontendUrl === "") return undefined;
    return new URL(frontendUrl).origin;
  } catch {
    return undefined;
  }
}

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
  let response: Response;
  if (fresh) {
    await hit.body?.cancel();
    const headers = new Headers(hit.headers);
    for (const name of ENTITY_HEADERS) headers.delete(name);
    response = new Response(null, { status: 304, headers });
  } else {
    response = new Response(hit.body, hit);
  }
  const vary = response.headers.get("Vary") ?? "";
  if (/\borigin\b/i.test(vary)) {
    const requestOrigin = request.headers.get("origin");
    const allowedOrigin = allowedCorsOrigin();
    if (
      requestOrigin !== null &&
      allowedOrigin !== undefined &&
      requestOrigin === allowedOrigin
    ) {
      response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    } else {
      response.headers.delete("Access-Control-Allow-Origin");
    }
  }
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
