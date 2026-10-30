import { expect, openTest, test } from "./fixtures";

for (const mode of ["time", "words"] as const) {
  test.describe(`${mode} refocus`, () => {
    test.use({
      config: {
        mode,
        time: 15,
        words: 15,
        quickRestart: "off",
        smoothCaret: "off",
      },
    });

    test("refreshes unstarted content once after window refocus", async ({
      page,
    }) => {
      await openTest(page);
      const words = page.locator("#words .word");
      const initial = await words.allTextContents();
      await page.evaluate(() => {
        window.dispatchEvent(new Event("blur"));
        window.dispatchEvent(new Event("focus"));
      });
      await expect
        .poll(async () => await words.allTextContents())
        .not.toEqual(initial);
      const refreshed = await words.allTextContents();
      await page.evaluate(() => {
        window.dispatchEvent(new Event("focus"));
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect(words).toHaveText(refreshed);
      await words.first().click();
      await page.keyboard.type(refreshed[0]?.[0] ?? "a");
      await expect(page.locator("#words letter.correct")).toHaveCount(1);
      await expect(words).toHaveText(refreshed);
    });
  });
}

test("refocus preserves typing progress and completed results", async ({
  page,
}) => {
  await openTest(page);
  const words = page.locator("#words .word");
  const original = await words.allTextContents();
  const text = original.join(" ");
  await words.first().click();
  await page.keyboard.type(text.slice(0, 1));
  await expect(page.locator("#words letter.correct")).toHaveCount(1);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
  });
  await expect(words).toHaveText(original);
  await expect(page.locator("#words letter.correct")).toHaveCount(1);
  await page.keyboard.type(text.slice(1), { delay: 20 });
  const result = page.locator("#result");
  await expect(result).toBeVisible();
  await expect(result).toHaveCSS("opacity", "1");
  const stats = page.locator("#result .stats");
  const completed = await stats.allTextContents();
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
  });
  await expect(result).toBeVisible();
  await expect(stats).toHaveText(completed);
  await expect(page.locator("#typingTest")).toBeHidden();
});
