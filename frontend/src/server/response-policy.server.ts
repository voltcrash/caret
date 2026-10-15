import "@tanstack/solid-start/server-only";

// The only permitted inline event is the static fallback's cache recovery action.
// SHA-256 of the exact warnings.html onclick body, checked by the boundary suite.
const recoveryHash = "iiia5AKJZAREDabTiAT6lsvuOYHKDHC9Rnk0lyzkrZo=";

export function applyResponsePolicy(
  response: Response,
  nonce: string,
  requestId: string,
  development: boolean,
): Response {
  const result = new Response(response.body, response);
  result.headers.set("Cache-Control", "no-store");
  result.headers.set("X-Request-Id", requestId);
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
  result.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      `script-src 'self' 'nonce-${nonce}'${development ? " 'unsafe-eval'" : ""}`,
      `script-src-attr 'unsafe-hashes' 'sha256-${recoveryHash}'`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data:",
      `connect-src 'self'${development ? " ws: wss:" : ""}`,
    ].join("; "),
  );
  return result;
}
