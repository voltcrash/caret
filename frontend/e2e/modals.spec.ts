import {
  assertRestarted,
  expect,
  openCommandline,
  openTest,
  runCommand,
  test,
} from "./fixtures";

test("theme preview dismissal leaves a closed dialog unable to block clicks or restart", async ({
  page,
}) => {
  await openTest(page);
  const background = await page
    .locator("body")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  await openCommandline(page);
  await page.locator("#commandLine input").fill("theme dracula");
  const theme = page.locator(
    '#commandLine [data-command-id="changeThemeDracula"]',
  );
  await expect(theme).toBeVisible();
  await theme.hover();
  await expect(page.locator("body")).not.toHaveCSS(
    "background-color",
    background,
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#commandLine")).toBeHidden();
  await expect(page.locator("#commandLine")).not.toHaveAttribute("open");
  await expect(page.locator("body")).toHaveCSS("background-color", background);
  await page.locator("#words").click();
  await expect(page.locator("#wordsInput")).toBeFocused();
  await page.keyboard.type("x");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await assertRestarted(page);
});

test("font selection closes its dialog and allows another modal to open", async ({
  page,
}) => {
  await openTest(page);
  await openCommandline(page);
  await runCommand(page, "setFontFamilyCourier", "font family courier");
  await expect(page.locator("#commandLine")).toBeHidden();
  await expect(page.locator("#words")).toHaveCSS("font-family", /Courier/);
  await openCommandline(page);
  await runCommand(page, "changeCustomModeText", "change custom text");
  await expect(page.locator("#CustomTextModal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#CustomTextModal")).toBeHidden();
  await expect(page.locator("#commandLine")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#commandLine")).toBeHidden();
  await page.locator("#words").click();
  await expect(page.locator("#wordsInput")).toBeFocused();
});

test("repeated opens and chained modals return to their parent", async ({
  page,
}) => {
  await openTest(page);
  for (let round = 0; round < 3; round++) {
    await openCommandline(page);
    await page.keyboard.press("Escape");
    await expect(page.locator("#commandLine")).toBeHidden();
  }
  await openCommandline(page);
  await runCommand(page, "changeCustomModeText", "change custom text");
  const custom = page.locator("#CustomTextModal");
  await expect(custom).toBeVisible();
  await custom
    .getByRole("button", { name: "saved texts", exact: true })
    .click();
  await expect(custom).toBeHidden();
  await expect(page.locator("#SavedTextsModal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#SavedTextsModal")).toBeHidden();
  await expect(custom).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(custom).toBeHidden();
  await expect(page.locator("#commandLine")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#commandLine")).toBeHidden();
  await page.locator("#restartTestButton").click();
  await assertRestarted(page);
});

test.describe("saved custom theme preview", () => {
  test.use({
    authenticated: true,
    customThemes: [
      {
        _id: "saved_theme",
        name: "saved_e2e",
        colors: [
          "#ffffff",
          "#333333",
          "#444444",
          "#eeeeee",
          "#000000",
          "#ff0000",
          "#ff0000",
          "#ff0000",
          "#ff0000",
          "#ff0000",
        ],
      },
    ],
  });
  test("dismisses without leaving an invisible click interceptor", async ({
    page,
  }) => {
    await openTest(page);
    const background = await page
      .locator("body")
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    await openCommandline(page);
    await page.locator("#commandLine input").fill("saved e2e");
    const theme = page.locator(
      '#commandLine [data-command-id="setCustomThemeIdsaved_theme"]',
    );
    await expect(theme).toBeVisible();
    await theme.hover();
    await expect(page.locator("body")).not.toHaveCSS(
      "background-color",
      background,
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("#commandLine")).toBeHidden();
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      background,
    );
    await page.locator("#restartTestButton").click();
    await assertRestarted(page);
  });
});
