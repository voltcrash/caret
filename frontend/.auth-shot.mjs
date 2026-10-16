import { chromium } from "playwright";
import { createHmac } from "node:crypto";
const [url, out, token] = process.argv.slice(2);
const sig = createHmac(
  "sha256",
  "stage-one-local-only-secret-at-least-32-characters",
)
  .update(token)
  .digest("base64");
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});
await ctx.addCookies([
  {
    name: "oxytype.session_token",
    value: encodeURIComponent(`${token}.${sig}`),
    url: "http://127.0.0.1:4185",
  },
]);
const page = await ctx.newPage();
await page.addInitScript(() =>
  localStorage.setItem(
    "acceptedCookies",
    JSON.stringify({ security: false, analytics: false, sentry: false }),
  ),
);
const errors = [];
const api = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("response", (r) => {
  if (r.url().includes("/api/"))
    api.push(`${r.status()} ${new URL(r.url()).pathname}`);
});
await page.goto(url);
await page.waitForTimeout(3500);
await page.screenshot({ path: out, fullPage: false });
console.log(JSON.stringify({ errors, api }, null, 1));
await browser.close();
