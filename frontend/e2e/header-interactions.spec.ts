import { assertRestarted, expect, openTest, test } from "./fixtures";

for (const theme of ["aether", "serika"] as const) {
  test.describe(`${theme} theme indicator`, () => {
    test.use({ config: { theme }, reducedMotion: "reduce" });

    test("uses the current theme accent on hover and restores its normal color", async ({
      page,
    }) => {
      await openTest(page);
      const indicator = page.locator('[data-ui-element="themeIndicator"]');
      await expect(indicator).toHaveText(theme);
      const normal = await indicator.evaluate(
        (element) => getComputedStyle(element).color,
      );
      const accent = await page
        .locator('[data-ui-element="logoText"] svg')
        .evaluate((element) => getComputedStyle(element).color);
      expect(accent).not.toBe(normal);
      await indicator.hover();
      await expect(indicator).toHaveCSS("color", accent);
      await page.mouse.move(0, 0);
      await expect(indicator).toHaveCSS("color", normal);
      await expect(page.locator("#commandLine")).toBeHidden();
    });
  });
}

test("the wordmark navigates home from settings without a document reload", async ({
  page,
}) => {
  await openTest(page);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  let documentRequests = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documentRequests++;
    }
  });
  await page.getByRole("link", { name: "Caret Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#words")).toBeVisible();
  await expect(page.locator("#commandLine")).toBeHidden();
  expect(documentRequests).toBe(0);
});

test("the wordmark restarts typing while the theme name alone opens the picker", async ({
  page,
}) => {
  await openTest(page);
  await page.locator("#words .word").first().click();
  await page.keyboard.type("x");
  await page.getByRole("link", { name: "Caret Home", exact: true }).click();
  await assertRestarted(page);
  await expect(page.locator("#commandLine")).toBeHidden();
  await page.locator('[data-ui-element="themeIndicator"]').click();
  await expect(page.locator("#commandLine")).toBeVisible();
  await expect(
    page.locator('#commandLine [data-command-id="changeThemeAether"]'),
  ).toBeVisible();
});
