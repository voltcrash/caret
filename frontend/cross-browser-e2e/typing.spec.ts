import {
  expect,
  openTest,
  completeWords,
  assertRestarted,
  test,
} from "../e2e/fixtures";

test.use({ config: { mode: "words", words: 10, smoothCaret: "off" } });

test("typing, correction, prompt, result and restart work across engines", async ({
  page,
}) => {
  await openTest(page);
  const input = page.getByRole("textbox", {
    name: "Typing input",
    exact: true,
  });
  const first = await page.locator("#words .word").first().textContent();
  const second = await page.locator("#words .word").nth(1).textContent();
  expect(first).toBeTruthy();
  await expect(input).toHaveAccessibleDescription(new RegExp(`Type: ${first}`));
  await page.locator("#words .word").first().click();
  await page.keyboard.insertText("x");
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText(`${first} `);
  await expect(input).toHaveValue(" ");
  await expect(input).toHaveAccessibleDescription(
    new RegExp(`Type: ${second}`),
  );
  await page.locator("#restartTestButton").click();
  await assertRestarted(page);
  await completeWords(page);
  await expect(page.locator("#result")).toBeVisible();
  await page.getByRole("button", { name: "Next test", exact: true }).click();
  await expect(input).toBeEnabled();
});
