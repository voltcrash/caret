# Search and AI discovery

Caret's canonical origin is `https://caret.voltcrash.com`. Search engines and AI
search systems receive the same server-rendered product overview, guides and
metadata as visitors. The interactive typing engine still requires JavaScript.

## Repository implementation

- `frontend/src/app/seo.ts` keeps canonical, description, Open Graph and Twitter
  metadata consistent. Query variants of the typing test canonicalize to `/`.
- The homepage includes a visible product overview below the test, common
  questions and links to three distinct typing guides. Guides render on the server.
  Each guide opens with a short answer and a real editorial update date, matching
  its `WebPage.dateModified` value and sitemap `lastmod`. Change a guide's date
  only after a substantive content update; never advance it automatically on requests or builds.
- JSON-LD identifies the website and free web application; guides include
  breadcrumbs. Facts must match visible content. Do not invent ratings, reviews,
  usage figures or dates, or promise a rich result.
- `frontend/static/sitemap.xml` lists maintained, indexable public pages. Add new
  editorial pages there and link them from relevant existing pages. Do not list
  search filters, private accounts, missing profiles or utility pages.
- `robots.txt` allows public pages for all crawlers, including OAI-SearchBot,
  Claude-SearchBot, PerplexityBot, Googlebot and Bingbot. API/RPC paths are excluded.
  Login, account, settings, profile lookup and callback documents use `noindex`;
  crawlers can fetch those documents to read that instruction.
- `llms.txt` is an optional concise reference to real pages. Provider adoption
  varies; it is not a prerequisite for indexing or a proven ranking mechanism.
  Google explicitly ignores these special files for ranking. An extra JSON feed
  is not required for public text already available in server-rendered HTML.
- Training crawlers remain allowed. Search access and training permission are
  separate choices; blocking training bots is not an SEO requirement.
- Existing fonts/engine preloads, social image, lazy engine loading and static
  no-JavaScript/no-CSS recovery fallbacks are retained.

## After deployment: owner-controlled work

These steps require the site's search-provider or Cloudflare accounts. A repository
change cannot register properties, obtain search analytics or guarantee recommendations.

1. Verify the domain in [Google Search Console](https://search.google.com/search-console)
   and [Bing Webmaster Tools](https://www.bing.com/webmasters/). Submit
   `https://caret.voltcrash.com/sitemap.xml` in both. Inspect `/` and each guide for
   successful indexing, the selected canonical and rendered content.
2. Check the deployed sitemap, robots file, guides and social image return HTTP 200
   with their correct content types. Use Google's
   [Rich Results Test](https://search.google.com/test/rich-results) for JSON-LD
   diagnostics; valid schema alone does not qualify an app for every rich result.
3. Check Cloudflare WAF, bot protection and AI crawler settings. Public documents
   and assets must be accessible without login or a challenge. Verify actual bot
   traffic against provider guidance; do not bypass security based only on a
   spoofable User-Agent. `robots.txt` cannot override an edge block.
4. Keep staging and preview hosts out of search using deployment-level
   `X-Robots-Tag: noindex` policies, including responses served as static assets.
   Canonicals alone do not prevent those hosts from being indexed.
5. Track impressions, clicks, queries, indexed pages and Core Web Vitals in search
   tools. Compare consistent periods after recrawling. Check referrals from AI
   search in existing analytics; do not infer success from crawler visits alone.
6. Keep guides accurate as features change. Link to Caret from the public project
   README and legitimate community resources; avoid purchased links, copied pages,
   keyword stuffing and mass-generated doorway pages.

## Verification

From the repository root:

```sh
vp run build
vp run --filter @caret/frontend lint
```

From `frontend/`, after that build finishes:

```sh
vp test run --config vitest.start.config.ts __tests__/start/seo.spec.ts
vp exec playwright test --config playwright.start.config.ts start-e2e/seo.spec.ts
```

The Worker tests fetch every sitemap page without running JavaScript, parse the
homepage JSON-LD, check canonical/metadata uniqueness, exercise crawler User-Agents
and verify utility-page indexing directives. Browser tests check layout, mobile
width, client navigation and metadata/schema replacement.

## Provider guidance

- [Google: generative AI search optimization](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
  — foundational SEO and useful, crawlable content remain the starting point.
- [Google: JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
  — server rendering also helps crawlers that do not execute JavaScript.
- [Google: publication and update dates](https://developers.google.com/search/docs/appearance/publication-dates)
  — show accurate, clearly labeled dates consistent with structured data.
- [OpenAI: publishers and developers FAQ](https://help.openai.com/en/articles/12627856)
  — allow OAI-SearchBot for search summaries and snippets.
- [Anthropic: web crawlers](https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)
  — Claude-SearchBot and Claude-User have distinct search/retrieval roles.

Search inclusion, ranking and model recommendations are provider decisions. This
implementation improves discoverability and the quality of public source material;
it cannot force a recommendation or change a model's existing training data.
