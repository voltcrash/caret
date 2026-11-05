import { expect, test } from "./fixtures";

test("one input command can start and finish a short test", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "config",
      JSON.stringify({
        mode: "words",
        words: 1,
        quickEnd: true,
        smoothCaret: "off",
      }),
    );
  });
  await page.goto("/");
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
  const word = page.locator("#words .word").first();
  const text = (await word.textContent()) ?? "";
  expect(text.length).toBeGreaterThan(0);
  await word.click();
  await page.keyboard.insertText(text);
  await expect(page.locator("#result")).toHaveCSS("opacity", "1");
  await expect(page.locator("#resultSummary")).toContainText("Test complete.");
  await expect(page.locator("#testInitFailed")).toBeHidden();
});

test("a timed-out chart retries the same completion and permits the next test", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "config",
      JSON.stringify({
        mode: "words",
        words: 10,
        smoothCaret: "off",
        quickRestart: "off",
      }),
    );
  });
  const releaseChart = Promise.withResolvers<undefined>();
  let chartRequested = false;
  await page.route("**/assets/ResultChart-*.js", async (route) => {
    chartRequested = true;
    await releaseChart.promise;
    await route.continue();
  });
  await page.clock.install();
  await page.goto("/");
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
  const words = await page.locator("#words .word").allTextContents();
  expect(words).toHaveLength(10);
  await page.locator("#words .word").first().click();
  await page.keyboard.type(words.join(" "), { delay: 40 });
  await expect.poll(() => chartRequested).toBe(true);
  await page.clock.runFor(16_000);
  await expect(
    page.getByText(
      "Could not finish displaying your result. Retry or start a new test.",
    ),
  ).toBeVisible();
  await expect(page.locator("#wordsInput")).toBeDisabled();
  await page.getByRole("button", { name: "Retry result", exact: true }).click();
  releaseChart.resolve(undefined);
  await expect(page.locator("#result")).toHaveCSS("opacity", "1");
  await expect(page.locator("#resultSummary")).toContainText("Test complete.");
  await expect(
    page.getByRole("button", { name: "Retry result", exact: true }),
  ).toBeHidden();
  await page.screenshot({ path: info.outputPath("recovered-result.png") });
  await page.locator("#nextTestButton").click();
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
  await expect(page.locator("#result")).toBeHidden();
  await expect(page.locator("#wordsInput")).toBeEnabled();
  await page.locator("#words .word").first().click();
  await page.keyboard.type("x");
  await expect(page.locator("#wordsInput")).toHaveValue(" x");
});
