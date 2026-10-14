import { expect, openCommandline, openTest, test } from "./fixtures";

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
