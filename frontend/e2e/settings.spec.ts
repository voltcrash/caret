import { expect, openTest, test } from "./fixtures";

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
