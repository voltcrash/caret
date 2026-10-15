import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createWorkerd } from "./workerd";

describe("Start document and response policy in workerd", () => {
  let mf: Awaited<ReturnType<typeof createWorkerd>>;
  beforeAll(async () => {
    mf = await createWorkerd();
  });
  afterAll(async () => await mf?.dispose());

  it("renders static fallbacks and gives every executable script a fresh CSP nonce", async () => {
    const response = await mf.dispatchFetch("http://localhost:3000/about");
    const html = await response.text();
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce).toBeDefined();
    expect(csp).not.toContain("script-src 'unsafe-inline'");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Request-Id")).not.toBeNull();
    expect(html).toContain("<noscript data-nosnippet>");
    expect(html).toContain('id="nocss"');
    expect(html).toContain("reinstallServiceWorker()");
    const scripts = [...html.matchAll(/<script\b([^>]*)>/g)];
    expect(scripts.length).toBeGreaterThan(2);
    for (const script of scripts) {
      expect(script[1]).toContain(`nonce="${nonce}"`);
    }
    const warnings = readFileSync(
      resolve(import.meta.dirname, "../../src/html/warnings.html"),
      "utf8",
    );
    const handlers = [...warnings.matchAll(/onclick="([^"]+)"/g)];
    expect(handlers).toHaveLength(1);
    const hash = createHash("sha256")
      .update(handlers[0]?.[1] ?? "")
      .digest("base64");
    expect(csp).toContain(`script-src-attr 'unsafe-hashes' 'sha256-${hash}'`);
    const next = await mf.dispatchFetch("http://localhost:3000/about");
    expect(next.headers.get("Content-Security-Policy")).not.toBe(csp);
    await next.text();
  });

  it("serves generated CSS/fonts/icons/manifest and immutable versioned assets", async () => {
    const response = await mf.dispatchFetch("http://localhost:3000/about");
    const html = await response.text();
    const css = /href="([^"]+\.css)"/.exec(html)?.[1];
    expect(css).toBeDefined();
    for (const path of [
      css,
      "/webfonts/RobotoMono-Regular.woff2",
      "/webfonts/LexendDeca-Regular.woff2",
      "/images/favicon/oxytype.svg",
      "/manifest.start.webmanifest",
    ]) {
      const asset = await mf.dispatchFetch(`http://localhost:3000${path}`);
      expect(asset.status).toBe(200);
      if (path === css) {
        expect(asset.headers.get("Cache-Control")).toContain("immutable");
      }
      await asset.arrayBuffer();
    }
  });

  it("preserves popup and standalone 404 URLs", async () => {
    const popup = await mf.dispatchFetch(
      "http://localhost:3000/oauth-callback.html?requestId=fixture",
    );
    expect(popup.status).toBe(200);
    expect(popup.headers.get("Cache-Control")).toBe("no-store");
    expect(await popup.text()).toContain("Sign in | Oxytype");
    const missing = await mf.dispatchFetch("http://localhost:3000/404.html");
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain("Page not found");
  });

  it("bounds streamed auth bodies without dropping response policy", async () => {
    const response = await mf.dispatchFetch(
      "http://localhost:3000/api/auth/sign-out",
      {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({ padding: "x".repeat(102_400) }),
      },
    );
    expect(response.status).toBe(413);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("renders root errors without exposing database details or secrets", async () => {
    const db = await mf.getD1Database("DB", "b");
    await db.prepare("DROP TABLE public_stats").run();
    const worker = await mf.getWorker("b");
    const response = await worker.fetch("http://localhost:3000/about");
    expect(response.status).toBe(500);
    const html = await response.text();
    expect(html).toContain("Unable to load Oxytype");
    expect(html).not.toContain("no such table");
    expect(html).not.toContain("stage-one-local-only-secret");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
