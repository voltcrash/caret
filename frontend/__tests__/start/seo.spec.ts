import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { createWorkerd, seedSession } from "./workerd";

const origin = "http://localhost:3000";
const canonical = "https://caret.voltcrash.com";

describe("search and AI discovery in the built Worker", () => {
  let mf: Awaited<ReturnType<typeof createWorkerd>>;
  beforeAll(async () => {
    mf = await createWorkerd();
  });
  afterAll(async () => await mf?.dispose());

  it("serves the product explanation and structured data without executing JavaScript", async () => {
    const response = await mf.dispatchFetch(`${origin}/?utm_source=search`);
    expect(response.status).toBe(200);
    const html = await response.text();
    const head = html.split("</head>")[0] ?? "";
    expect(head).toContain("Free Typing Test &amp; Online Typing Practice");
    expect(head).toContain(`rel="canonical" href="${canonical}/"`);
    expect(head).toContain('property="og:url"');
    expect(head).toContain('name="twitter:description"');
    expect(head).not.toContain("noindex");
    expect(html).toContain('id="about-caret"');
    expect(html).toContain("no account is needed");
    expect(html).toContain('href="/typing-practice"');
    expect(html).toContain('href="/typing-speed-test"');
    expect(html).toContain('href="/typing-for-programmers"');
    expect(html).toContain("<noscript");
    expect(html).toContain('id="nocss"');

    const script =
      /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/.exec(
        html,
      );
    expect(script).not.toBeNull();
    expect(JSON.parse(script?.[1] ?? "null")).toMatchObject({
      "@context": "https://schema.org",
      "@graph": expect.arrayContaining([
        expect.objectContaining({ "@type": "WebSite", name: "Caret" }),
        expect.objectContaining({
          "@type": "WebApplication",
          url: `${canonical}/`,
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      ]),
    });
  });

  it("serves every sitemap URL as a canonical indexable page with unique metadata", async () => {
    const response = await mf.dispatchFetch(`${origin}/sitemap.xml`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("xml");
    const sitemap = await response.text();
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => match[1] ?? "",
    );
    expect(urls).toHaveLength(5);
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const url of urls) {
      expect(url.startsWith(`${canonical}/`)).toBe(true);
      const page = await mf.dispatchFetch(`${origin}${new URL(url).pathname}`);
      expect(page.status).toBe(200);
      expect(page.headers.get("X-Robots-Tag")).toBeNull();
      const html = await page.text();
      const head = html.split("</head>")[0] ?? "";
      expect(head.match(/rel="canonical"/g)).toHaveLength(1);
      expect(head).toContain(`rel="canonical" href="${url}"`);
      expect(head).not.toContain("noindex");
      titles.add(/<title\b[^>]*>(.*?)<\/title>/.exec(head)?.[1] ?? "");
      descriptions.add(
        /name="description" content="([^"]+)"/.exec(head)?.[1] ?? "",
      );
      if (new URL(url).pathname.startsWith("/typing-")) {
        expect(html).toContain("<h1");
        expect(html).toContain("Start a free typing test");
        expect(html).toContain('"@type":"BreadcrumbList"');
      }
    }
    expect(titles.size).toBe(urls.length);
    expect(descriptions.size).toBe(urls.length);
    expect(titles.has("")).toBe(false);
    expect(descriptions.has("")).toBe(false);
  });

  it("allows search crawlers to read the same public content as visitors", async () => {
    const robots = await mf.dispatchFetch(`${origin}/robots.txt`);
    expect(robots.status).toBe(200);
    expect(await robots.text()).toContain(
      `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /_serverFn/\n\nSitemap: ${canonical}/sitemap.xml`,
    );
    for (const agent of [
      "OAI-SearchBot",
      "Claude-SearchBot",
      "PerplexityBot",
      "Googlebot",
      "bingbot",
    ]) {
      const page = await mf.dispatchFetch(`${origin}/`, {
        headers: { "user-agent": agent },
      });
      expect(page.status).toBe(200);
      expect(await page.text()).toContain('id="about-caret"');
    }
    const reference = await mf.dispatchFetch(`${origin}/llms.txt`);
    expect(reference.status).toBe(200);
    expect(reference.headers.get("Content-Type")).toContain("text/plain");
    expect(await reference.text()).toContain(`${canonical}/typing-practice`);
  });

  it("keeps utility pages and missing documents out of search", async () => {
    for (const path of [
      "/login",
      "/settings",
      "/profile",
      "/oauth-callback.html",
      "/unknown-route",
    ]) {
      const response = await mf.dispatchFetch(`${origin}${path}`);
      expect(response.status).toBe(path === "/unknown-route" ? 404 : 200);
      expect(await response.text()).toContain(
        'name="robots" content="noindex,follow"',
      );
    }
    const worker = await mf.getWorker("a");
    const session = await seedSession(mf, "a");
    const account = await worker.fetch(`${origin}/account`, {
      headers: { cookie: session.cookie },
    });
    expect(account.status).toBe(200);
    expect(await account.text()).toContain(
      'name="robots" content="noindex,follow"',
    );
  });
});
