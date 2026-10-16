import { fixtureClientIp } from "./auth-fixtures";
import { test as base, expect } from "playwright/test";

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

export { expect };
