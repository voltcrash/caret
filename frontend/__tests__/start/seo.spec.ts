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

  it("keeps homepage metadata and an about link without the product overview", async () => {
    const response = await mf.dispatchFetch(`${origin}/?utm_source=search`);
    expect(response.status).toBe(200);
    const html = await response.text();
    const head = html.split("</head>")[0] ?? "";
    expect(head).toContain("Free Typing Test &amp; Online Typing Practice");
    expect(head).toContain(`rel="canonical" href="${canonical}/"`);
    expect(head).toContain('property="og:url"');
    expect(head).toContain('name="twitter:description"');
    expect(head).not.toContain("noindex");
    expect(html).toContain('href="/about"');
    expect(html).not.toContain('id="about-caret"');
    expect(html).not.toContain("Practice your way");
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

  it("serves the product overview and guide links on /about without executing JavaScript", async () => {
    const response = await mf.dispatchFetch(`${origin}/about`);
    expect(response.status).toBe(200);
    const html = await response.text();
    const head = html.split("</head>")[0] ?? "";
    expect(head).toContain("About Caret | Free Typing Test");
    expect(head).toContain(`rel="canonical" href="${canonical}/about"`);
    expect(head).not.toContain("noindex");
    expect(html).toContain('id="about-caret"');
    expect(html).toContain("No account is needed");
    expect(html).toContain("Practice your way");
    expect(html).toContain("Questions about Caret");
    expect(html).toContain('href="/guides"');
    expect(html).toContain("Start a free typing test");
  });

  it("server-renders the guides index with links to all three articles", async () => {
    const response = await mf.dispatchFetch(`${origin}/guides`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Typing Guides | Caret");
    expect(html).toContain('href="/guide/typing-practice"');
    expect(html).toContain('href="/guide/typing-speed-test"');
    expect(html).toContain('href="/guide/typing-for-programmers"');
  });

  it("removes the old guide URLs without redirects", async () => {
    for (const slug of [
      "typing-practice",
      "typing-speed-test",
      "typing-for-programmers",
    ]) {
      const worker = await mf.getWorker("a");
      const response = await worker.fetch(`${origin}/${slug}`, {
        redirect: "manual",
      });
      expect(response.status).toBe(404);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("serves every sitemap URL as a canonical indexable page with unique metadata", async () => {
    const response = await mf.dispatchFetch(`${origin}/sitemap.xml`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("xml");
    const sitemap = await response.text();
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => match[1] ?? "",
    );
    expect(urls).toHaveLength(7);
    expect(urls).toContain(`${canonical}/about`);
    expect(urls).toContain(`${canonical}/guides`);
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
      if (new URL(url).pathname.startsWith("/guide/")) {
        expect(html).toContain("<h1");
        expect(html).toContain("Start a free typing test");
        expect(html).toContain('"@type":"BreadcrumbList"');
        expect(html).toContain('"name":"Guides"');
        expect(html).toContain('href="/guides"');
        expect(html).toContain('aria-label="Quick answer"');
        const updated = /<time\b[^>]*datetime="([^"]+)"/.exec(html)?.[1];
        expect(updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(html).toContain(`"dateModified":"${updated}"`);
        expect(sitemap).toContain(
          `<loc>${url}</loc><lastmod>${updated}</lastmod>`,
        );
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
    expect(await robots.text()).toBe(
      `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /_serverFn/\n\nSitemap: ${canonical}/sitemap.xml\n`,
    );
    for (const agent of [
      "OAI-SearchBot",
      "Claude-SearchBot",
      "PerplexityBot",
      "Googlebot",
      "bingbot",
      "GPTBot",
      "ClaudeBot",
    ]) {
      const page = await mf.dispatchFetch(`${origin}/`, {
        headers: { "user-agent": agent },
      });
      expect(page.status).toBe(200);
      expect(await page.text()).toContain('href="/about"');
      const about = await mf.dispatchFetch(`${origin}/about`, {
        headers: { "user-agent": agent },
      });
      expect(about.status).toBe(200);
      expect(await about.text()).toContain('id="about-caret"');
    }
    const reference = await mf.dispatchFetch(`${origin}/llms.txt`);
    expect(reference.status).toBe(200);
    expect(reference.headers.get("Content-Type")).toContain("text/plain");
    const referenceText = await reference.text();
    expect(referenceText).toContain(`${canonical}/about`);
    expect(referenceText).toContain(`${canonical}/guides`);
    expect(referenceText).toContain(`${canonical}/guide/typing-practice`);
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
    const db = await mf.getDatabase("a");
    await db
      .prepare(
        "INSERT INTO users(uid,id,name,name_key,email,added_at,data) VALUES(?,?,?,?,?,0,?)",
      )
      .bind(
        session.uid,
        session.uid,
        "seo-account",
        "seo-account",
        "seo-account@example.test",
        JSON.stringify({ uid: session.uid }),
      )
      .run();
    const account = await worker.fetch(`${origin}/account`, {
      headers: { cookie: session.cookie },
      redirect: "manual",
    });
    expect(account.status).toBe(200);
    const html = await account.text();
    expect(html).toContain("Account | Caret");
    expect(html).toMatch(/name="robots" content="noindex(?:,[^"]*)?"/);
  });
});
