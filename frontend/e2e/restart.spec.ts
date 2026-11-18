import {
  assertRestarted,
  completeWords,
  expect,
  openTest,
  test,
} from "./fixtures";

for (const method of ["tab+enter", "button"] as const) {
  test(`restart with ${method} clears an active test`, async ({ page }) => {
    await openTest(page);
    await page.locator("#words").click();
    await page.keyboard.type("x");
    await expect(page.locator("#wordsInput")).toHaveValue(" x");
    if (method === "tab+enter") {
      await page.keyboard.press("Tab");
      await expect(page.locator("#restartTestButton")).toBeFocused();
      await page.keyboard.press("Enter");
    } else {
      await page.locator("#restartTestButton").click();
    }
    await assertRestarted(page);
    await page.locator("#words").click();
    await page.keyboard.type("y");
    await expect(page.locator("#wordsInput")).toHaveValue(" y");
  });
}

for (const [setting, key] of [
  ["tab", "Tab"],
  ["esc", "Escape"],
  ["enter", "Enter"],
] as const) {
  test.describe(`${setting} quick restart`, () => {
    test.use({
      config: {
        mode: "words",
        words: 15,
        quickRestart: setting,
        smoothCaret: "off",
      },
    });

    test("clears active tests and keeps the typing input focused", async ({
      page,
    }) => {
      await openTest(page);
      await page.locator("#words").click();
      for (const input of ["x", "y"]) {
        await page.keyboard.type(input);
        await expect(page.locator("#wordsInput")).toHaveValue(` ${input}`);
        await page.keyboard.press(key);
        await assertRestarted(page);
        await expect(page.locator("#wordsInput")).toBeFocused();
      }
    });

    test("starts another test from the result screen", async ({ page }) => {
      await openTest(page);
      await completeWords(page);
      // restart is ignored until the result fade-in finishes
      const result = page.locator("#result");
      await expect(result).toHaveCSS("opacity", "1");
      await expect(result).toBeFocused();
      if (setting === "esc") {
        // A hovered result hint consumes the first Escape; the next restarts.
        await result.locator(".acc [data-balloon-pos]").hover();
        await expect(page.getByRole("tooltip")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("tooltip")).toHaveCount(0);
        await expect(result).toBeVisible();
        await expect(result).toBeFocused();
      }
      await page.keyboard.press(key);
      await assertRestarted(page);
      await expect(page.locator("#result")).toBeHidden();
      await expect(page.locator("#wordsInput")).toBeFocused();
      await page.keyboard.type("x");
      await expect(page.locator("#wordsInput")).toHaveValue(" x");
    });
  });
}

test.describe("long tests", () => {
  test.use({
    config: { mode: "words", words: 0, quickRestart: "tab" },
  });

  test("shows the quick restart notice with its icon beside the title", async ({
    page,
  }) => {
    await openTest(page);
    const notifications = page.locator('[data-ui-element="notifications"]');
    await expect(notifications).toBeAttached();
    await page.locator("#words .word").first().click();
    await page.keyboard.type("x");
    await expect(page.locator("#wordsInput")).toHaveValue(" x");
    await page.keyboard.press("Tab");

    await expect(notifications).toContainText(
      "Quick restart disabled in long tests.",
    );
    const title = await notifications
      .getByText("Notice", { exact: true })
      .boundingBox();
    const icon = await notifications.locator("i").boundingBox();
    if (title === null || icon === null) {
      throw new Error("Missing notice header");
    }
    expect(icon.x + icon.width).toBeLessThan(title.x);
    expect(
      Math.abs(icon.y + icon.height / 2 - (title.y + title.height / 2)),
    ).toBeLessThan(2);
  });
});
