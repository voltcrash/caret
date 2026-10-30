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
