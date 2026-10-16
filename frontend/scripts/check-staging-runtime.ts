import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { z } from "zod";

const origin = "https://oxytype-api-staging.voltcrash.workers.dev";
const historySchema = z.object({
  files: z.record(
    z
      .string()
      .regex(/^\/(?:assets|js|css|webfonts)\/[\w.-]+\.(?:js|css|woff2)$/),
    z.string(),
  ),
});
function requireCheck(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const output = process.argv[2];
  if (output === undefined) throw new Error("Provide evidence output path");
  const startedAt = new Date().toISOString();
  const versionResponse = await fetch(`${origin}/version.json`, {
    cache: "no-store",
  });
  const { version } = z
    .object({ version: z.string() })
    .parse(await versionResponse.json());
  const routes: Record<string, number> = {};
  const latency: number[] = [];
  for (const [path, expected] of [
    ["/", 200],
    ["/about", 200],
    ["/settings", 200],
    ["/login", 200],
    ["/account", 307],
    ["/profile", 200],
    ["/privacy-policy.html", 200],
    ["/oauth-callback.html?requestId=stage7-check", 200],
    ["/404.html", 404],
    ["/api", 200],
    ["/api/public/typingStats", 200],
    ["/api/users", 401],
    ["/api/not-a-route", 404],
  ] as const) {
    const response = await fetch(`${origin}${path}`, {
      redirect: "manual",
      cache: "no-store",
    });
    requireCheck(
      response.status === expected,
      `${path}: ${response.status}, expected ${expected}`,
    );
    requireCheck(
      response.headers.get("X-Oxytype-Build") === version,
      `${path}: wrong Worker build`,
    );
    requireCheck(
      response.headers.get("Cache-Control") === "no-store",
      `${path}: document/private response must not cache`,
    );
    const body = await response.text();
    if (path === "/about") {
      requireCheck(
        body.includes("<noscript data-nosnippet>") &&
          body.includes('id="nocss"'),
        "Static recovery fallbacks missing",
      );
      const csp = response.headers.get("Content-Security-Policy") ?? "";
      const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
      requireCheck(nonce !== undefined, "Document has no CSP nonce");
      for (const script of body.matchAll(/<script\b([^>]*)>/g)) {
        requireCheck(
          script[1]?.includes(`nonce="${nonce}"`) === true,
          "Unnonced executable script",
        );
      }
      requireCheck(
        !(/(?:^|;)\s*script-src\s+([^;]+)/.exec(csp)?.[1] ?? "").includes(
          "'unsafe-inline'",
        ),
        "Broad inline script CSP",
      );
    }
    routes[path] = response.status;
  }
  const missing = await fetch(`${origin}/_serverFn/${"0".repeat(64)}`, {
    headers: { origin, "x-tsr-serverFn": "true" },
  });
  requireCheck(
    missing.status === 409 &&
      missing.headers.get("X-Oxytype-Stale-Client") === "1",
    "Stale function did not give the controlled refresh signal",
  );
  await missing.text();
  const crossSite = await fetch(`${origin}/_serverFn/${"0".repeat(64)}`, {
    method: "POST",
    headers: {
      origin: "https://attacker.test",
      "content-type": "application/json",
      "x-tsr-serverFn": "true",
    },
    body: "{}",
  });
  requireCheck(
    crossSite.status === 403 &&
      !crossSite.headers.has("X-Oxytype-Stale-Client"),
    "Direct function CSRF failed",
  );
  await crossSite.text();
  for (const [path, cache] of [
    ["/sw.js", "no-cache"],
    ["/version.json", "no-cache"],
    ["/release.json", "no-store"],
    ["/_asset-history.json", "no-store"],
  ] as const) {
    const response = await fetch(`${origin}${path}`, { cache: "no-store" });
    requireCheck(
      response.status === 200 &&
        response.headers.get("Cache-Control") === cache,
      `${path}: wrong delivery cache policy`,
    );
    const body = await response.text();
    if (path === "/sw.js") {
      requireCheck(
        body.includes(version),
        "Worker and service worker builds differ",
      );
    }
  }
  const history = historySchema.parse(
    await (
      await fetch(`${origin}/_asset-history.json`, { cache: "no-store" })
    ).json(),
  );
  const pending = Object.entries(history.files);
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      for (let item = pending.pop(); item !== undefined; item = pending.pop()) {
        const [path, expected] = item;
        const response = await fetch(`${origin}${path}`);
        requireCheck(
          response.status === 200,
          `Retained asset unavailable: ${path}`,
        );
        const hash = createHash("sha256")
          .update(new Uint8Array(await response.arrayBuffer()))
          .digest("hex");
        requireCheck(
          hash === expected,
          `Retained asset integrity mismatch: ${path}`,
        );
      }
    }),
  );
  const oauth = await fetch(`${origin}/api/auth/sign-in/social`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({
      provider: "github",
      callbackURL: `${origin}/oauth-callback.html?requestId=stage7-check`,
      disableRedirect: true,
    }),
  });
  requireCheck(oauth.status === 200, "OAuth initiation failed");
  const provider = z.object({ url: z.url() }).parse(await oauth.json());
  const redirect = new URL(provider.url);
  requireCheck(
    redirect.hostname === "github.com" &&
      redirect.searchParams.get("redirect_uri") ===
        `${origin}/api/auth/callback/github`,
    "OAuth callback/origin changed",
  );
  const cookies = oauth.headers.getSetCookie();
  requireCheck(
    cookies.some(
      (cookie) => /HttpOnly/i.test(cookie) && /Secure/i.test(cookie),
    ),
    "OAuth state cookie lost Secure/HttpOnly",
  );
  // Keep provider URLs, cookie values and OAuth state out of evidence.
  for (let sample = 0; sample < 20; sample++) {
    const before = performance.now();
    const response = await fetch(`${origin}/about`, { cache: "no-store" });
    requireCheck(response.status === 200, "SSR latency sample failed");
    await response.text();
    latency.push(performance.now() - before);
  }
  await writeFile(
    output,
    `${JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), origin, build: version, routes, assets: { checked: Object.keys(history.files).length, legacy: Object.keys(history.files).filter((path) => path.startsWith("/js/") || path.startsWith("/css/") || path.startsWith("/webfonts/")).length, allIntegrityChecksPass: true }, staleFunctionStatus: missing.status, csrfStatus: crossSite.status, oauth: { initiation: oauth.status, providerHost: redirect.hostname, callback: `${origin}/api/auth/callback/github`, secureHttpOnlyStateCookie: true, fullInteractiveSignIn: "separate browser acceptance" }, ssrNetworkWallMs: latency, latencyDefinition: "Hosted staging /about wall time from this host, including network/D1; not comparable to frozen local workerd CPU or browser budgets" }, null, 2)}\n`,
  );
  console.log(
    `Staging ${version}: routes, ${Object.keys(history.files).length} assets, CSP, auth cookies and stale functions pass`,
  );
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
