import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { aboutFaq } from "../../src/features/discover/about-faq";
import { createWorkerd, seedSession } from "./workerd";

const origin = "http://localhost:3000";
const canonical = "https://caret.voltcrash.com";

function structuredGraph(html: string): Record<string, unknown>[] {
  const script =
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/.exec(
      html,
    );
  expect(script).not.toBeNull();
  return (
    JSON.parse(script?.[1] ?? "null") as { "@graph": Record<string, unknown>[] }
  )["@graph"];
}

describe("search and AI discovery in the built Worker", () => {
  let mf: Awaited<ReturnType<typeof createWorkerd>>;
  beforeAll(async () => {
    mf = await createWorkerd();
  });
  afterAll(async () => await mf?.dispose());

  it("keeps discovery metadata in the head and explanatory copy off the typing screen", async () => {
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
    expect(html).not.toMatch(/<h1\b[^>]*>Caret typing test<\/h1>/);
    expect(html).not.toContain("Measure your typing speed and accuracy");
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
          "@type": "Organization",
          "@id": `${canonical}/#organization`,
          name: "Caret",
          alternateName: "Caret typing test",
          logo: `${canonical}/images/icons/caret-512.png`,
          sameAs: ["https://github.com/voltcrash/caret"],
        }),
        expect.objectContaining({
          "@type": "WebApplication",
          url: `${canonical}/`,
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        }),
      ]),
    });
  });

  it("places static recovery warnings after the main content", async () => {
    for (const path of ["/", "/about", "/guide/typing-speed-test"]) {
      const response = await mf.dispatchFetch(`${origin}${path}`);
      const html = await response.text();
      const mainEnd = html.indexOf("</main>");
      expect(mainEnd).toBeGreaterThan(0);
      expect(html.indexOf("<noscript")).toBeGreaterThan(mainEnd);
      expect(html.indexOf('id="nocss"')).toBeGreaterThan(mainEnd);
      expect(html).toContain("reinstallServiceWorker()");
    }
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
    expect(html).toContain('href="/guide"');
    expect(html).toContain("Start a free typing test");
    expect(structuredGraph(html)).toContainEqual(
      expect.objectContaining({
        "@type": "FAQPage",
        url: `${canonical}/about`,
        mainEntity: aboutFaq.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      }),
    );
    for (const faq of aboutFaq) {
      expect(html).toContain(faq.question);
      expect(html).toContain(faq.answer);
    }
  });

  it("server-renders the guides index with links to all six articles", async () => {
    const response = await mf.dispatchFetch(`${origin}/guide`);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Typing Guides | Caret");
    expect(html).toContain('href="/guide/typing-practice"');
    expect(html).toContain('href="/guide/typing-speed-test"');
    expect(html).toContain('href="/guide/typing-for-programmers"');
    expect(html).toContain('href="/guide/wpm-calculator"');
    expect(html).toContain('href="/guide/how-to-type-faster"');
    expect(html).toContain('href="/guide/average-typing-speed"');
  });

  it("removes the old content URLs without redirects", async () => {
    for (const slug of [
      "guides",
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
    expect(urls).toHaveLength(10);
    expect(urls).toContain(`${canonical}/about`);
    expect(urls).toContain(`${canonical}/guide`);
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
        expect(html).toContain('href="/guide"');
        expect(html).toContain('aria-label="Quick answer"');
        const updated = /<time\b[^>]*datetime="([^"]+)"/.exec(html)?.[1];
        expect(updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(html).toContain(`"dateModified":"${updated}"`);
        expect(structuredGraph(html)).toContainEqual(
          expect.objectContaining({
            "@type": "Article",
            url,
            dateModified: updated,
            author: {
              "@type": "Organization",
              name: "Caret contributors",
              url: "https://github.com/voltcrash/caret",
            },
            publisher: { "@id": `${canonical}/#organization` },
            mainEntityOfPage: { "@id": url },
          }),
        );
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
    expect(referenceText).toContain(`${canonical}/guide`);
    expect(referenceText).toContain(`${canonical}/guide/typing-practice`);
    expect(referenceText).not.toContain("privacy-policy.html");
    for (const slug of [
      "wpm-calculator",
      "how-to-type-faster",
      "average-typing-speed",
    ]) {
      expect(referenceText).toContain(`${canonical}/guide/${slug}`);
    }
  });

  it("matches installed-app metadata to the homepage and serves the organization logo", async () => {
    const response = await mf.dispatchFetch(`${origin}/`);
    const head = (await response.text()).split("</head>")[0] ?? "";
    const manifestResponse = await mf.dispatchFetch(`${origin}/manifest.json`);
    expect(manifestResponse.status).toBe(200);
    const manifest = (await manifestResponse.json()) as {
      description: string;
      theme_color: string;
      background_color: string;
    };
    expect(head).toContain(
      `name="description" content="${manifest.description}"`,
    );
    expect(head).toContain(
      `name="theme-color" content="${manifest.theme_color}"`,
    );
    expect(manifest.background_color).toBe(manifest.theme_color);
    const logo = await mf.dispatchFetch(`${origin}/images/icons/caret-512.png`);
    expect(logo.status).toBe(200);
    expect(logo.headers.get("Content-Type")).toContain("image/png");
    await logo.arrayBuffer();
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
