import { expect, test } from "./fixtures";

test("keyboard navigation moves focus to content and preserves history without document loads", async ({
  page,
}) => {
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documents.push(request.url());
    }
  });
  await page.goto("/about");
  await page.waitForLoadState("networkidle");
  const settings = page.getByRole("link", { name: "Settings", exact: true });
  await settings.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.locator("main")).toBeFocused();
  await expect(page.locator("#group_behavior")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator("main")).toBeFocused();
  await page.goForward();
  await expect(page).toHaveURL(/\/settings$/);
  expect(documents).toHaveLength(1);
});

test("command palette navigation and shared modals work across native route mounts", async ({
  page,
}) => {
  await page.goto("/about");
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("ControlOrMeta+K");
  const palette = page.locator("#commandLine");
  await expect(palette).toBeVisible();
  await palette.locator("input").fill("view settings");
  await expect(
    palette.locator('[data-command-id="viewSettings"]'),
  ).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings$/);
  await expect(palette).toBeHidden();
  await page.getByRole("link", { name: "About", exact: true }).click();
  await page.getByRole("button", { name: "support", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Support Oxytype" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Support Oxytype" }),
  ).toBeHidden();
});

test("window and settings scroll restore on history traversal", async ({
  page,
}) => {
  await page.goto("/about");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
  await expect
    .poll(async () => await page.evaluate(() => window.scrollY))
    .toBe(600);
  // Keyboard activation avoids scrolling the header back into view before leaving.
  await page
    .getByRole("link", { name: "Settings", exact: true })
    .focus({ timeout: 5000 });
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/settings$/);
  const scroller = page.locator('[data-scroll-restoration-id="page-content"]');
  await expect(page.locator("#group_behavior")).toBeVisible();
  await scroller.evaluate((element) =>
    element.scrollTo({ top: 350, behavior: "instant" }),
  );
  await expect
    .poll(async () => await scroller.evaluate((element) => element.scrollTop))
    .toBe(350);
  await page.getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/settings$/);
  await expect
    .poll(async () => await scroller.evaluate((element) => element.scrollTop))
    .toBe(350);
  await page.goBack();
  await expect(page).toHaveURL(/\/about$/);
  // A remounted chart/font can shift the browser's scroll anchor by a pixel.
  await expect
    .poll(async () =>
      Math.abs((await page.evaluate(() => window.scrollY)) - 600),
    )
    .toBeLessThan(5);
});
