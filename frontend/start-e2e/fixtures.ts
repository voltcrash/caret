import { test as base, expect } from "playwright/test";

/** Starts with cookie preferences answered, like the legacy browser fixture. */
export const test = base.extend({
  page: async ({ page }, use) => {
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
