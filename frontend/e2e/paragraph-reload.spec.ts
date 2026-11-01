import { completeWords, expect, openTest, test } from "./fixtures";

for (const authenticated of [false, true]) {
  test.describe(authenticated ? "signed-in reload" : "guest reload", () => {
    test.use({ authenticated });

    test("generates different words on every reload with saved preferences", async ({
      page,
    }) => {
      await openTest(page);
      for (let reload = 0; reload < 3; reload++) {
        const previous = await page.locator("#words .word").allTextContents();
        expect(previous).toHaveLength(15);
        await page.reload();
        await expect(page.locator("#words .word")).toHaveCount(15);
        await expect(page.locator("#words .word")).not.toHaveText(previous);
        await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
      }
    });
  });
}

test.describe("default startup", () => {
  test.use({ config: {} });

  test("generates fresh default words even without a preview cookie", async ({
    page,
    context,
  }) => {
    await openTest(page);
    const previous = await page.locator("#words .word").allTextContents();
    await context.clearCookies({ name: "caret_typing_preview" });
    await page.reload();
    await expect(page.locator("#words .word")).toHaveCount(previous.length);
    await expect(page.locator("#words .word")).not.toHaveText(previous);
  });
});

test("only the explicit repeat action reuses the previous paragraph", async ({
  page,
}) => {
  await openTest(page);
  const previous = await page.locator("#words .word").allTextContents();
  await completeWords(page);
  await expect(page.locator("#result")).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Repeat test", exact: true }).click();
  await expect(page.locator("#words .word")).toHaveText(previous);
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "Restart Test", exact: true }).click();
  await expect(page.locator("#words .word")).not.toHaveText(previous);
});
