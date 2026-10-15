import { assertRestarted, expect, openTest, test } from "./fixtures";

test("settings change persists through reload", async ({ page }) => {
  await openTest(page);
  await page.goto("/settings?highlight=quickRestart");
  const setting = page.locator('[data-setting-key="quickRestart"]');
  await expect(setting).toBeVisible();
  const button = setting.getByRole("button", { name: "tab", exact: true });
  await button.click();
  await expect(button).toHaveClass(/active/);
  await page.reload();
  await expect(setting).toBeVisible();
  await expect(button).toHaveClass(/active/);
});

test("enabling Tab quick restart works immediately and after reload", async ({
  page,
}) => {
  await openTest(page);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const setting = page.locator('[data-setting-key="quickRestart"]');
  await setting.getByRole("button", { name: "tab", exact: true }).click();
  await page.getByRole("link", { name: "Test", exact: true }).click();

  for (const input of ["x", "y"]) {
    await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
    await page.locator("#words").click();
    await page.keyboard.type(input);
    await expect(page.locator("#wordsInput")).toHaveValue(` ${input}`);
    await page.keyboard.press("Tab");
    await assertRestarted(page);
    await expect(page.locator("#wordsInput")).toBeFocused();
    if (input === "x") await page.reload();
  }

  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await setting.getByRole("button", { name: "off", exact: true }).click();
  await page.getByRole("link", { name: "Test", exact: true }).click();
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
  await page.locator("#words").click();
  await page.keyboard.type("z");
  await page.keyboard.press("Tab");
  await expect(page.locator("#restartTestButton")).toBeFocused();
  await expect(page.locator("#wordsInput")).toHaveValue(" z");
});
