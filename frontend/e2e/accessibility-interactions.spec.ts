import {
  assertRestarted,
  completeWords,
  expect,
  openCommandline,
  openTest,
  runCommand,
  test,
} from "./fixtures";

test("modal focuses its input, traps Tab and returns to its trigger", async ({
  page,
}) => {
  await openTest(page);
  const trigger = page.getByRole("button", {
    name: "Custom word count",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Custom Word Amount" });
  const input = dialog.getByRole("spinbutton");
  await expect(input).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "apply", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(input).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveCSS("outline-style", "solid");
  await expect(trigger).toHaveCSS("outline-width", "2px");
});

test("chained modals return focus through their parent to the typing input", async ({
  page,
}) => {
  await openTest(page);
  await page.locator("#words .word").first().click();
  await expect(page.locator("#wordsInput")).toBeFocused();
  await openCommandline(page);
  await runCommand(page, "changeCustomModeText", "change custom text");
  const custom = page.locator("#CustomTextModal");
  await expect(custom.locator("textarea")).toBeFocused();
  await custom
    .getByRole("button", { name: "saved texts", exact: true })
    .click();
  await expect(page.locator("#SavedTextsModal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(custom.locator("textarea")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#commandLine input")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#commandLine")).toBeHidden();
  await expect(page.locator("#wordsInput")).toBeFocused();
});

test("command palette input shows no focus outline", async ({ page }) => {
  await openTest(page);
  await openCommandline(page);
  await expect(page.locator("#commandLine input")).toHaveCSS(
    "outline-style",
    "none",
  );
});

test("other text inputs keep the focus outline", async ({ page }) => {
  await openTest(page);
  await page
    .getByRole("button", { name: "Custom word count", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  const input = page
    .getByRole("dialog", { name: "Custom Word Amount" })
    .getByRole("spinbutton");
  await expect(input).toBeFocused();
  await expect(input).toHaveCSS("outline-style", "solid");
});

test("result summary stays silent during typing and clears on restart", async ({
  page,
}) => {
  await openTest(page);
  const summary = page.locator("#resultSummary");
  await expect(summary).toHaveAttribute("aria-live", "polite");
  await expect(summary).toHaveText("");
  await page.locator("#words .word").first().click();
  await page.keyboard.type("x");
  await expect(summary).toHaveText("");
  await page.locator("#restartTestButton").click();
  await assertRestarted(page);
  await completeWords(page);
  await expect(summary).toContainText("Test complete.");
  await expect(summary).toContainText("Accuracy 100%");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await assertRestarted(page);
  await expect(summary).toHaveText("");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("disables control transitions and caret animations while dialogs and restart work", async ({
    page,
  }) => {
    await openTest(page);
    await expect(page.locator("#restartTestButton")).toHaveCSS(
      "transition-duration",
      "0s",
    );
    await expect(page.locator("#caret")).toHaveCSS("animation-name", "none");
    await page
      .getByRole("button", { name: "Custom word count", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Custom Word Amount" });
    await expect(dialog.getByRole("spinbutton")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await page.locator("#restartTestButton").click();
    await assertRestarted(page);
  });
});

test.describe("theme actions", () => {
  test.use({
    authenticated: true,
    customThemes: [
      {
        _id: "accessible_theme",
        name: "accessible",
        colors: [
          "#323437",
          "#e2b714",
          "#e2b714",
          "#d1d0c5",
          "#646669",
          "#2c2e31",
          "#ca4754",
          "#7e2a33",
          "#ca4754",
          "#7e2a33",
        ],
      },
    ],
  });
  test("theme and favorite actions support keyboard focus without nested buttons", async ({
    page,
  }) => {
    await openTest(page);
    await page.goto("/settings");
    await page.getByRole("button", { name: "theme", exact: true }).click();
    const favorite = page.getByRole("button", {
      name: "Favorite theme dracula",
      exact: true,
    });
    await favorite.focus();
    await expect(favorite.locator("..")).toHaveCSS("opacity", "1");
    await page.keyboard.press("Space");
    await expect(favorite).toHaveAttribute("aria-pressed", "true");
    const preset = page.getByRole("button", {
      name: "Apply theme dracula",
      exact: true,
    });
    await preset.focus();
    await page.keyboard.press("Enter");
    await expect(preset).toHaveAttribute("aria-pressed", "true");
    await page
      .locator('[data-setting-key="theme"]')
      .getByRole("button", { name: "custom", exact: true })
      .click();
    const custom = page.getByRole("button", {
      name: "Apply theme accessible",
      exact: true,
    });
    await expect(custom).toBeVisible();
    await custom.focus();
    await expect(
      page.getByRole("button", { name: "Edit theme accessible", exact: true }),
    ).toHaveCSS("opacity", "1");
    await expect(
      page.locator("button button, [role=button] [role=button]"),
    ).toHaveCount(0);
  });
});
