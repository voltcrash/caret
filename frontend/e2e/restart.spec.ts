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
