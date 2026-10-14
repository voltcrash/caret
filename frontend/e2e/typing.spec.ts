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

  const words = await displayedWords.allTextContents();
  await page.locator("#words").click();
  await expect(page.locator("#wordsInput")).toBeFocused();
  // Key events exercise the input pipeline; a modest delay keeps WPM realistic.
  await page.keyboard.type(words.join(" "), { delay: 60 });
  await expect(page.locator("#result")).toBeVisible();

  const result = page.locator("#result");
  await expect(result.locator(".wpm .text")).toHaveText("wpm");
  const wpm = result.locator(".wpm .bottom");
  await expect(wpm).toHaveText(/^\d+$/);
  expect(Number(await wpm.textContent())).toBeGreaterThan(0);
  await expect(result.locator(".acc .bottom")).toHaveText("100%");
  await expect(result.locator(".testType .bottom").first()).toContainText(
    "words 15",
  );
});
