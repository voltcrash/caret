import { assertRestarted, expect, openTest, test } from "./fixtures";

test("leaving and returning discards an incomplete typing attempt", async ({
  page,
}) => {
  await openTest(page);
  const word = page.locator("#words .word").first();
  await word.click();
  await page.keyboard.type((await word.textContent())?.slice(0, 2) ?? "ab");
  await expect(
    page.locator("#words letter.correct, #words letter.incorrect"),
  ).toHaveCount(2);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.locator("#group_behavior")).toBeVisible();
  // Back can race route teardown, which has no DOM signal; retry until the
  // typing route returns.
  await expect(async () => {
    if (new URL(page.url()).pathname !== "/") await page.goBack();
    await expect(page.locator("#words")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await assertRestarted(page);
});
