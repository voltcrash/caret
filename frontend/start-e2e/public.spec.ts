import { expect, test } from "./fixtures";

test("profile route owns client selection and lookup navigation", async ({
  page,
}) => {
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documents.push(request.url());
    }
  });
  await page.goto("/profile/fixture-profile");
  await expect(page.getByText("fixture-profile public bio")).toBeVisible();
  const length = await page.evaluate(() => history.length);
  await page.getByText("TUI", { exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/fixture-profile\?client=tui$/);
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.goto("/profile");
  await page.getByPlaceholder("username").fill("fixture-profile");
  // The lookup validates the name against the profile function first.
  const submit = page.locator("form button[type=submit]");
  await expect(submit).toBeEnabled({ timeout: 10_000 });
  await submit.click();
  await expect(page).toHaveURL(/\/profile\/fixture-profile$/);
  await expect(page.getByText("fixture-profile public bio")).toBeVisible();
  expect(documents).toHaveLength(2);
});
