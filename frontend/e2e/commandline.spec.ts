import {
  expect,
  openCommandline,
  openTest,
  runCommand,
  test,
} from "./fixtures";

test("command line opens, executes a command by keyboard, and closes", async ({
  page,
}) => {
  await openTest(page);
  await openCommandline(page);
  await page.locator("#commandLine input").fill("punctuation on");
  await expect(
    page.locator('#commandLine [data-command-id="setPunctuationTrue"]'),
  ).toHaveClass(/active/);
  await page.keyboard.press("Enter");
  await expect(page.locator("#commandLine")).toBeHidden();
  await expect(
    page
      .locator('[data-ui-element="testConfig"]')
      .getByRole("button", { name: "punctuation", exact: true }),
  ).toHaveClass(/active/);
  await openCommandline(page);
  await page.keyboard.press("Escape");
  await expect(page.locator("#commandLine")).toBeHidden();
});

test.describe("random theme picker", () => {
  test.use({
    config: {
      theme: "aether",
      randomTheme: "fav",
      favThemes: ["matrix"],
      singleListCommandLine: "on",
    },
  });

  for (const trigger of ["theme name", "logo text"] as const) {
    test(`preserves the random theme when opened from ${trigger}`, async ({
      page,
    }) => {
      await openTest(page);
      await openCommandline(page);
      await runCommand(page, "randomizeTheme", "next random theme");
      const picker = page.locator("#commandLine");
      const indicator = page.locator('[data-ui-element="themeIndicator"]');
      await expect(picker).toBeHidden();
      await expect(indicator).toHaveText("matrix");
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        "rgb(0, 0, 0)",
      );

      const opener =
        trigger === "theme name"
          ? indicator
          : page.getByRole("button", { name: "oxytype - change theme" });
      await opener.click();
      await expect(picker).toBeVisible();
      await expect(
        picker.locator('[data-command-id="changeThemeMatrix"]'),
      ).toHaveClass(/active/);
      await expect(indicator).toHaveText("matrix");
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        "rgb(0, 0, 0)",
      );

      await picker.locator('[data-command-id="changeThemeAether"]').hover();
      await expect(indicator).toHaveText("aether");
      await page.keyboard.press("Escape");
      await expect(picker).toBeHidden();
      await expect(indicator).toHaveText("matrix");

      await opener.click();
      await runCommand(page, "changeThemeSerika", "serika");
      await expect(picker).toBeHidden();
      await expect(indicator).toHaveText("serika");
      await page.reload();
      await expect(indicator).toHaveText("serika");
    });
  }
});
