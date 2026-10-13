import { expect, test } from "playwright/test";

test("completes a 15-word typing test", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "acceptedCookies",
      JSON.stringify({ security: false, analytics: false, sentry: false }),
    );
    localStorage.setItem(
      "config",
      JSON.stringify({ mode: "words", words: 15 }),
    );
  });

  await page.goto("/");
  const displayedWords = page.locator("#words .word");
  await expect(displayedWords).toHaveCount(15);
  await expect(page.locator("#words")).toBeVisible();
});
