import budgets from "../../docs/rust-engine/performance-budgets.json" with { type: "json" };
import { summarize } from "../scripts/migration-performance";
import { writeFile } from "node:fs/promises";
import { expect, test } from "playwright/test";

test("repeated production cold/warm input and public route readiness", async ({
  page,
  context,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "acceptedCookies",
      JSON.stringify({ security: false, analytics: false, sentry: false }),
    );
    localStorage.setItem(
      "config",
      JSON.stringify({ mode: "words", words: 15, smoothCaret: "off" }),
    );
  });
  const session = await context.newCDPSession(page);
  await session.send("Network.enable");
  // HTTP cache only: keep service workers out of cold/warm comparisons.
  await session.send("Network.setBypassServiceWorker", { bypass: true });
  const cold: number[] = [];
  const warm: number[] = [];
  const settings: number[] = [];
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
      // Start has no startup cover: input is ready once the restart fade ends.
      await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
      await word.click();
      await expect(page.locator("#wordsInput")).toBeFocused();
      const first = (await word.textContent())?.[0];
      if (first === undefined) throw new Error("Missing fixture word");
      await page.keyboard.type(first);
      await expect(word.locator("letter.correct")).toHaveCount(1);
      measurements.push(await page.evaluate(() => performance.now()));
    }
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#startupScreen")).toBeHidden();
    await expect(page.locator("#group_behavior")).toBeVisible();
    settings.push(await page.evaluate(() => performance.now()));
  }
  const output = process.env["MIGRATION_BASELINE_OUTPUT"];
  if (output === undefined) throw new Error("Set MIGRATION_BASELINE_OUTPUT");
  await writeFile(
    output,
    `${JSON.stringify({ fixture: "production assets, guest API fixtures, desktop Chromium, HTTP cache cold/warm, SW bypass", cold, warm, settings }, null, 2)}\n`,
  );
  if (process.env["ENGINE_ENFORCE_PERFORMANCE"] === "true") {
    expect(summarize(cold).median).toBeLessThanOrEqual(budgets.coldMedianMs);
    expect(summarize(cold).p95).toBeLessThanOrEqual(budgets.coldP95Ms);
    expect(summarize(warm).median).toBeLessThanOrEqual(budgets.warmMedianMs);
    expect(summarize(warm).p95).toBeLessThanOrEqual(budgets.warmP95Ms);
  }
});
