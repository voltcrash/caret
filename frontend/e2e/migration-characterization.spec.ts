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
  await page.getByRole("link", { name: "About", exact: true }).click();
  await expect(
    page.getByText("See contributor credits", { exact: true }),
  ).toBeVisible();
  await page.goBack();
  await assertRestarted(page);
});
