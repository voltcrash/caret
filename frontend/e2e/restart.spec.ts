import { assertRestarted, expect, openTest, test } from "./fixtures";

for (const method of ["tab+enter", "button"] as const) {
  test(`restart with ${method} clears an active test`, async ({ page }) => {
    await openTest(page);
    await page.locator("#words").click();
    await page.keyboard.type("x");
    await expect(page.locator("#wordsInput")).toHaveValue(" x");
    if (method === "tab+enter") {
      await page.keyboard.press("Tab");
      await expect(page.locator("#restartTestButton")).toBeFocused();
      await page.keyboard.press("Enter");
    } else {
      await page.locator("#restartTestButton").click();
    }
    await assertRestarted(page);
    await page.locator("#words").click();
    await page.keyboard.type("y");
    await expect(page.locator("#wordsInput")).toHaveValue(" y");
  });
}

for (const [setting, key] of [
  ["tab", "Tab"],
  ["esc", "Escape"],
  ["enter", "Enter"],
] as const) {
  test.describe(`${setting} quick restart`, () => {
    test.use({
      config: {
        mode: "words",
        words: 15,
        quickRestart: setting,
        smoothCaret: "off",
      },
    });

    test("clears active tests and keeps the typing input focused", async ({
      page,
    }) => {
      await openTest(page);
      await page.locator("#words").click();
      for (const input of ["x", "y"]) {
        await page.keyboard.type(input);
        await expect(page.locator("#wordsInput")).toHaveValue(` ${input}`);
        await page.keyboard.press(key);
        await assertRestarted(page);
        await expect(page.locator("#wordsInput")).toBeFocused();
      }
    });
  });
}
