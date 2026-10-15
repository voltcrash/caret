import { writeFile } from "node:fs/promises";
import { expect, test } from "./fixtures";

test("repeated production cold/warm input and public route readiness", async ({
  page,
  context,
}) => {
  const session = await context.newCDPSession(page);
  await session.send("Network.enable");
  // HTTP cache only: keep service workers out of cold/warm comparisons.
  await session.send("Network.setBypassServiceWorker", { bypass: true });
  const cold: number[] = [];
  const warm: number[] = [];
  const about: number[] = [];
  await page.route(
    "**/api/public/typingStats*",
    async (route) =>
      await route.fulfill({
        json: {
          message: "OK",
          data: { testsStarted: 100, testsCompleted: 80, timeTyping: 1200 },
        },
      }),
  );
  for (let sample = 0; sample < 10; sample++) {
    for (const [cacheDisabled, measurements] of [
      [true, cold],
      [false, warm],
    ] as const) {
      await session.send("Network.setCacheDisabled", { cacheDisabled });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.locator("#startupScreen")).toBeHidden();
      const word = page.locator("#words .word").first();
      await expect(word).toBeVisible();
      await word.click();
      await expect(page.locator("#wordsInput")).toBeFocused();
      const first = (await word.textContent())?.[0];
      if (first === undefined) throw new Error("Missing fixture word");
      await page.keyboard.type(first);
      await expect(word.locator("letter.correct")).toHaveCount(1);
      measurements.push(await page.evaluate(() => performance.now()));
    }
    await page.goto("/about", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#startupScreen")).toBeHidden();
    await expect(
      page.getByText("See contributor credits", { exact: true }),
    ).toBeVisible();
    about.push(await page.evaluate(() => performance.now()));
  }
  const output = process.env["MIGRATION_BASELINE_OUTPUT"];
  if (output === undefined) throw new Error("Set MIGRATION_BASELINE_OUTPUT");
  await writeFile(
    output,
    `${JSON.stringify({ fixture: "production assets, guest API fixtures, desktop Chromium, HTTP cache cold/warm, SW bypass", cold, warm, about }, null, 2)}\n`,
  );
});
