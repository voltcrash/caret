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

test("leaderboard search owns board and page with replace-only updates", async ({
  page,
}) => {
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documents.push(request.url());
    }
  });
  await page.goto("/about");
  await page.getByRole("link", { name: "Leaderboards", exact: true }).click();
  // The loaded board is spelled out in the address bar, replacing the entry.
  await expect(page).toHaveURL(
    /\/leaderboards\?client=web&type=allTime&mode=time&mode2=15&language=english&page=1$/,
  );
  await expect(page.getByText("racer-1", { exact: true })).toBeVisible();
  const length = await page.evaluate(() => history.length);
  await page
    .getByRole("button", { name: "Next leaderboard page" })
    .first()
    .click();
  await expect(page).toHaveURL(/page=2$/);
  await expect(page.getByText("racer-51", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.goBack();
  await expect(page).toHaveURL(/\/about$/);
  expect(documents).toHaveLength(1);
});

test("a bare leaderboard URL restores the stored selection", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "leaderboardSelector",
      JSON.stringify({ type: "weekly", previous: true }),
    ),
  );
  await page.goto("/leaderboards");
  await expect(page).toHaveURL(/type=weekly/);
  await expect(page).toHaveURL(/lastWeek=t/);
});
