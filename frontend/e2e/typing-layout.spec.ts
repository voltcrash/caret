import { expect, openTest, test } from "./fixtures";

test.use({ config: { mode: "time", time: 30, smoothCaret: "off" } });

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1536, height: 925 },
  { width: 1920, height: 1080 },
]) {
  test(`words sit near eye level at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openTest(page);
    const words = await page.locator("#wordsWrapper").boundingBox();
    if (!words) throw new Error("Words have no layout");
    const center = words.y + words.height / 2;
    expect(center).toBeGreaterThan(viewport.height * 0.4);
    expect(center).toBeLessThan(viewport.height * 0.49);
  });
}

test("key tips toggle without moving the desktop words", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 925 });
  await openTest(page);
  const before = await page.locator("#wordsWrapper").boundingBox();
  if (!before) throw new Error("Words have no layout");

  for (const state of ["show", "hide"]) {
    await page.goto("/settings?highlight=showKeyTips");
    const button = page
      .locator('[data-setting-key="showKeyTips"]')
      .getByRole("button", { name: state, exact: true });
    await button.click();
    await expect(button).toHaveClass(/active/);
    await page.getByRole("link", { name: "Oxytype Home", exact: true }).click();
    await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
    const after = await page.locator("#wordsWrapper").boundingBox();
    if (!after) throw new Error("Words have no layout");
    expect(after.y).toBeCloseTo(before.y, 0);
  }
});
