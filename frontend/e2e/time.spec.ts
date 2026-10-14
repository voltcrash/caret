import { expect, openTest, test } from "./fixtures";

test.use({ config: { mode: "time", time: 15 } });

test("time mode finishes at its configured duration", async ({ page }) => {
  await page.clock.install();
  await openTest(page);
  await page.locator("#words .word").first().click();
  const firstWord = await page.locator("#words .word").first().textContent();
  await page.keyboard.type(`${firstWord ?? ""} `);
  await expect(page.locator("#words letter.correct").first()).toBeVisible();
  await page.clock.runFor(15_000);
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#result .testType .bottom").first()).toContainText(
    "time 15",
  );
  await expect(page.locator("#result .time .bottom")).toContainText("15");
});
