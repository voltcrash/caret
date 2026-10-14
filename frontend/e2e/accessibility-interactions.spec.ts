import {
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
