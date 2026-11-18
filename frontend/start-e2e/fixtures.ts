import { fixtureClientIp } from "./auth-fixtures";
import { test as base, expect, type Route } from "playwright/test";

/** Starts with cookie preferences answered, like the legacy browser fixture. */
export const test = base.extend({
  page: async ({ page, context }, use, info) => {
    await context.setExtraHTTPHeaders({
      ...info.project.use.extraHTTPHeaders,
      "cf-connecting-ip": fixtureClientIp(info.testId),
    });
    await page.addInitScript(() => {
      localStorage.setItem(
        "acceptedCookies",
        JSON.stringify({ security: false, analytics: false, sentry: false }),
      );
    });
    await use(page);
  },
});

/** Simulate unavailable CSS while retaining the static recovery controls. */
export async function blockDocumentStyles(route: Route): Promise<void> {
  const response = await route.fetch();
  const headers = response.headers();
  await route.fulfill({
    response,
    headers: {
      ...headers,
      "content-security-policy": `${headers["content-security-policy"]}; style-src-elem 'none'`,
    },
  });
}

export { expect };
