import { expect, test } from "./fixtures";

for (const width of [1280, 320]) {
  test(`profile hint supports keyboard dismissal and fits a ${width}px viewport`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 720 });
    await page.goto("/profile/fixture-profile");
    const trigger = page.getByText(/^Joined /).first();
    await expect(trigger).toBeVisible();
    await expect(trigger).toHaveAccessibleDescription(/.+/);
    const hint = await trigger.evaluate(
      (element) =>
        document.getElementById(element.getAttribute("aria-describedby") ?? "")
          ?.textContent ?? "",
    );

    await trigger.focus();
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText(hint);
    await expect
      .poll(async () => {
        const box = await tooltip.boundingBox();
        return (
          box !== null &&
          box.x >= 0 &&
          box.y >= 0 &&
          box.x + box.width <= width &&
          box.y + box.height <= 720
        );
      })
      .toBe(true);
    await info.attach(`tooltip-${width}`, {
      body: await page.screenshot({
        path: info.outputPath(`tooltip-${width}.png`),
      }),
      contentType: "image/png",
    });

    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.keyboard.press("Tab");
    await expect(trigger).not.toBeFocused();

    await trigger.hover();
    await expect(tooltip).toBeVisible();
    await tooltip.hover();
    await expect(tooltip).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);
  });
}

for (const quickRestart of ["tab", "enter"]) {
  test(`result hints preserve keyboard navigation with ${quickRestart} quick restart`, async ({
    page,
  }) => {
    await page.addInitScript((quickRestart) => {
      localStorage.setItem(
        "config",
        JSON.stringify({
          mode: "words",
          words: 10,
          quickRestart,
          smoothCaret: "off",
        }),
      );
    }, quickRestart);
    await page.goto("/");
    const words = page.locator("#words .word");
    await expect(words.first()).toBeVisible();
    await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
    const text = (await words.allTextContents()).join(" ");
    await words.first().click();
    await page.keyboard.type(text, { delay: 40 });
    const result = page.locator("#result");
    await expect(result).toHaveCSS("opacity", "1");
    await expect(result).toBeFocused();

    const speed = result.locator(".wpm [data-balloon-pos]").last();
    const accuracy = result.locator(".acc [data-balloon-pos]");
    await speed.focus();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(result).toBeVisible();
    await expect(speed).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(accuracy).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(speed).toBeFocused();

    await page.locator("#showWordHistoryButton").click();
    await page.locator("#watchReplayButton").click();
    const history = page.locator("#resultWordsHistory");
    const replay = page.locator("#resultReplay");
    await expect(history).toBeVisible();
    await expect(replay).toBeVisible();
    const copy = page.locator("#copyWordsListButton");
    // Start before the first history control so Tab must discover it.
    await copy.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(copy).not.toBeFocused();
    for (const id of [
      "copyWordsListButton",
      "copyMissedWordsListButton",
      "copySlowWordsListButton",
      "toggleBurstHeatmap",
      "playpauseReplayButton",
    ]) {
      await page.keyboard.press("Tab");
      const control = page.locator(`#${id}`);
      await expect(control).toBeFocused();
      await expect(control).toHaveAccessibleDescription(/.+/);
      await expect(page.getByRole("tooltip")).toBeVisible();
    }
    await page.keyboard.press("Enter");
    await expect(page.locator("#playpauseReplayButton")).toHaveAccessibleName(
      "Pause replay",
    );
    await expect(result).toBeVisible();
  });
}
