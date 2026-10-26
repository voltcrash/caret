import "@tanstack/solid-start/server-only";
import { serverBuildId } from "./observability.server";

// The only permitted inline event is the static fallback's cache recovery action.
// SHA-256 of the exact warnings.html onclick body, checked by the boundary suite.
const recoveryHash = "iiia5AKJZAREDabTiAT6lsvuOYHKDHC9Rnk0lyzkrZo=";
const sentryOrigin = import.meta.env.CARET_SENTRY_ORIGIN ?? "";

export function applyResponsePolicy(
  response: Response,
  nonce: string,
  requestId: string,
  development: boolean,
): Response {
  const result = new Response(response.body, response);
  // Only shareable operation responses (see edge-cache) carry s-maxage.
  if (!/\bs-maxage=\d+/.test(result.headers.get("Cache-Control") ?? "")) {
    result.headers.set("Cache-Control", "no-store");
  }
  result.headers.set("X-Request-Id", requestId);
  // Public, like /version.json: correlates a response with its client assets.
  result.headers.set("X-Caret-Build", serverBuildId);
  result.headers.set("X-Content-Type-Options", "nosniff");
  result.headers.set("X-Frame-Options", "SAMEORIGIN");
  result.headers.set("Referrer-Policy", "same-origin");
  result.headers.set("X-DNS-Prefetch-Control", "off");
  if (!development) {
    result.headers.set(
      "Strict-Transport-Security",
      "max-age=15552000; includeSubDomains",
    );
  }
  if (!result.headers.has("Content-Security-Policy")) {
    result.headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'self'",
        "frame-ancestors 'self'",
        "object-src 'none'",
        "frame-src https://challenges.cloudflare.com",
        `script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com 'nonce-${nonce}'${development ? " 'unsafe-eval'" : ""}`,
        `script-src-attr 'unsafe-hashes' 'sha256-${recoveryHash}'`,
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self' data:",
        "img-src 'self' data: http: https:",
        `connect-src 'self' https://challenges.cloudflare.com https://poetrydb.org https://*.wikipedia.org${sentryOrigin === "" ? "" : ` ${sentryOrigin}`}${development ? " ws: wss:" : ""}`,
      ].join("; "),
    );
  }
  return result;
}
