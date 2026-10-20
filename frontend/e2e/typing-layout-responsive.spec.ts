import { assertRestarted, expect, openTest, test } from "./fixtures";

for (const viewport of [
  { width: 375, height: 667 },
  { width: 812, height: 375 },
]) {
  test.describe(`touch ${viewport.width}×${viewport.height}`, () => {
    test.use({
      viewport,
      hasTouch: true,
      isMobile: true,
      config: {
        mode: "time",
        time: 30,
        fontSize: 3,
        keymapMode: "static",
        showKeyTips: true,
        smoothCaret: "off",
      },
    });

    test("keeps words and restart reachable without desktop footer space", async ({
      page,
    }) => {
      await openTest(page);
      await expect(
        page.getByRole("button", { name: /test settings:/ }),
      ).toBeVisible();
      await expect(page.locator("footer")).toHaveCSS("height", "0px");
      await page.locator("#wordsWrapper").tap();
      await expect(page.locator("#wordsInput")).toBeFocused();
      await page.keyboard.type("x");
      await expect(page.locator("#wordsInput")).toHaveValue(" x");
      await page.locator("#restartTestButton").tap();
      await assertRestarted(page);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width);
    });
  });
}

test.describe("short desktop with tall settings", () => {
  test.use({
    viewport: { width: 1280, height: 600 },
    config: {
      mode: "words",
      words: 100,
      fontSize: 3,
      maxLineWidth: 40,
      showAllLines: true,
      keymapMode: "static",
      keymapSize: 3.5,
      smoothCaret: "off",
    },
  });

  test("grows the page so the words, keymap and footer do not overlap", async ({
    page,
  }) => {
    await openTest(page);
    // Read together: automatic scrolling can move the page between calls.
    const layout = await page.evaluate(() => {
      const rect = (selector: string): { top: number; bottom: number } => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing ${selector}`);
        const bounds = element.getBoundingClientRect();
        return { top: bounds.top, bottom: bounds.bottom };
      };
      return {
        words: rect("#wordsWrapper"),
        keymap: rect('[data-ui-element="keymap"]'),
        typing: rect("#typingTest"),
        footer: rect("footer"),
      };
    });
    expect(layout.keymap.top).toBeGreaterThanOrEqual(layout.words.bottom);
    expect(layout.footer.top).toBeGreaterThanOrEqual(layout.typing.bottom);
    await expect(page.locator("#restartTestButton")).toBeVisible();
    await page.locator("#restartTestButton").click();
    await assertRestarted(page);
    await page.locator("#words .word").first().click();
    await page.keyboard.type("x");
    await expect(page.locator("#wordsInput")).toHaveValue(" x");
  });
});
