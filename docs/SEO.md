# Search and AI discovery

Caret's canonical origin is `https://caret.voltcrash.com`. Search engines and AI
search systems receive the same server-rendered product overview, guides and
metadata as visitors. The interactive typing engine still requires JavaScript.

## Repository implementation

- `frontend/src/app/seo.ts` keeps canonical, description, Open Graph and Twitter
  metadata consistent. Query variants of the typing test canonicalize to `/`.
- Keep the homepage focused on typing: no promotional heading, description,
  footer copy or SEO-only offscreen text. Its title, description, canonical and
  JSON-LD stay in the document head. The existing About navigation link leads to
  `/about`, which contains the visible product overview and FAQ; `/guide` links to six
  server-rendered guides, including WPM calculations, improving speed and fair
  average-speed comparisons.
  Each guide opens with a short answer and a real editorial update date, matching
  its `WebPage.dateModified` value and sitemap `lastmod`. Change a guide's date
  only after a substantive content update; never advance it automatically on requests or builds.
- JSON-LD identifies the website, free web application and Caret organization with
  its real logo and GitHub identity. `/about` has `FAQPage` data sourced from the
  same answers as the visible FAQ. Guides have `Article` data with Caret
  contributors as author, Caret as publisher, and breadcrumbs. Facts must match
  visible content. Do not invent ratings, reviews, usage figures, publication dates
  or social profiles, or promise a rich result or AI recommendation.
- `frontend/static/sitemap.xml` lists maintained, indexable public pages. Add new
  editorial pages there and link them from relevant existing pages. Do not list
  search filters, private accounts, missing profiles or utility pages.
- `robots.txt` allows public pages for all crawlers, including OAI-SearchBot,
  Claude-SearchBot, PerplexityBot, Googlebot and Bingbot. API/RPC paths are excluded.
  Login, account, settings, profile lookup and callback documents use `noindex`;
  crawlers can fetch those documents to read that instruction.
- Public profiles are indexable when the fetched public data has a nonempty bio
  or a time-15/time-60 personal best shown in the server summary. Name-only,
  banned, missing and unavailable profiles use `noindex`. They remain accessible
  through their existing links and lookup flow.
- Populated leaderboards already render their requested page of ranks on the
  server. Empty databases and failed public reads cannot supply ranking rows;
  do not replace them with fabricated entries for crawlers.
- `llms.txt` is an optional concise reference to real pages. Provider adoption
  varies; it is not a prerequisite for indexing or a proven ranking mechanism.
  Google explicitly ignores these special files for ranking. An extra JSON feed
  is not required for public text already available in server-rendered HTML.
- Training crawlers remain allowed. Search access and training permission are
  separate choices; blocking training bots is not an SEO requirement.
- Existing fonts/engine preloads, social image, lazy engine loading and static
  no-JavaScript/no-CSS recovery fallbacks are retained. The static warnings follow
  page content in document order, so raw-text readers encounter the content first.
  Their fixed overlays and service-worker recovery action still work.
- The installed-app manifest shares the homepage description and default theme
  color with document metadata. Its existing app ID, scope and icon URLs remain.

Product explanations belong on `/about` and useful practice articles on `/guide`.
Both are linked and listed in the sitemap, so visitors and crawlers can find them
without adding content to the typing screen. Do not add crawler-only markup or
hide keyword copy with CSS. Metadata can describe the actual typing application
without duplicating that description above the test. Search snippets and rankings
remain provider decisions; this layout choice does not guarantee equivalent rankings.

## Editorial data and remaining discovery work

The speed histogram is derived from all-time leaderboard personal bests in
`backend/src/dal/leaderboards.ts`, not every completed test. Do not turn it into
"average WPM from N Caret tests" or a population benchmark. The average-speed
guide explains the sample limitation and labels its arithmetic as examples.
Publishing a measured aggregate later needs a documented sample, collection
period, exclusions and calculation method.

Repository fixes do not establish indexing or outside mentions. No search account
verification, sitemap submission, IndexNow notification or community post is
performed by these changes. Follow the owner checklist after deployment.

## After deployment: owner-controlled work

These steps require the site's search-provider or Cloudflare accounts. A repository
change cannot register properties, obtain search analytics or guarantee recommendations.

1. Verify the domain in [Google Search Console](https://search.google.com/search-console)
   and [Bing Webmaster Tools](https://www.bing.com/webmasters/). Submit
   `https://caret.voltcrash.com/sitemap.xml` in both. Inspect `/` and each guide for
   successful indexing, the selected canonical and rendered content.
   For Bing, also use its URL Submission tools or configure
   [IndexNow](https://www.indexnow.org/documentation): publish the site's ownership
   key first, verify it is accessible, then submit changed canonical URLs. Keep
   account credentials out of this repository. Submission requests crawling;
   it does not guarantee inclusion.
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
   Suitable owner-led outreach includes Show HN, typing communities and relevant
   open-source tool lists. Use the name "Caret typing test" to disambiguate the
   project. Add new `sameAs` profiles only after they really exist and are owned
   by the project.

## Verification

From the repository root:

```sh
vp run build
vp run --filter @caret/frontend lint
```

From `frontend/`, after that build finishes:

```sh
vp test run --config vitest.start.config.ts __tests__/start/seo.spec.ts __tests__/start/routes.spec.ts __tests__/start/document.spec.ts
vp exec playwright test --config playwright.start.config.ts start-e2e/seo.spec.ts
```

The Worker tests fetch every sitemap page without running JavaScript, parse the
homepage, FAQ and Article JSON-LD, check canonical/metadata uniqueness and manifest
consistency, exercise crawler User-Agents, and verify profile/utility indexing
directives and populated leaderboard rows. Browser tests check layout, mobile
width, client navigation, metadata/schema replacement and CSS-failure recovery.

## Provider guidance

- [Google: search snippets](https://developers.google.com/search/docs/appearance/snippet)
  — Google may use a relevant meta description for the search snippet.
- [Google: hidden text abuse](https://developers.google.com/search/docs/essentials/spam-policies#hidden-text-and-link-abuse)
  — do not hide text solely to manipulate search engines.

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
