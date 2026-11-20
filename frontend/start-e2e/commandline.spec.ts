import type { Locator, Page } from "playwright/test";

import { expect, test } from "./fixtures";

async function openPalette(page: Page): Promise<Locator> {
  await page.keyboard.press("ControlOrMeta+K");
  const palette = page.locator("#commandLine");
  await expect(palette).toBeVisible();
  return palette;
}

test("typing commands join the palette on other routes", async ({ page }) => {
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");
  const palette = await openPalette(page);
  await palette.locator("input").fill("funbox mirror");
  await expect(
    palette.locator('[data-command-id="changeFunboxmirror"]'),
  ).toBeVisible();
  await palette.locator("input").fill("load challenge");
  await expect(
    palette.locator('[data-command-id^="loadChallenge"]').first(),
  ).toBeVisible();
});

test("result commands restart the test from the palette", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "config",
      JSON.stringify({
        mode: "words",
        words: 10,
        quickRestart: "off",
        smoothCaret: "off",
        resultSaving: false,
      }),
    );
  });
  await page.goto("/");
  await expect(page.locator("#words .word").first()).toBeVisible();
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
  const words = await page.locator("#words .word").allTextContents();
  await page.locator("#words .word").first().click();
  await page.keyboard.type(words.join(" "), { delay: 40 });
  await expect(page.locator("#result")).toHaveCSS("opacity", "1");
  // Restarts are ignored until the result has settled.
  await expect(page.locator("#result .loginTip")).toBeVisible();

  const palette = await openPalette(page);
  await palette.locator("input").fill("next test");
  const nextTest = palette.locator('[data-command-id="nextTest"]');
  await expect(nextTest).toBeVisible();
  await nextTest.click();

  await expect(page.locator("#result")).toBeHidden();
  await expect(page.locator("#words .word")).toHaveCount(10);
});
