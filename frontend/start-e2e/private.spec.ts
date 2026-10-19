import type { BrowserContext } from "playwright/test";

import { authCookie } from "./auth-fixtures";
import { expect, test } from "./fixtures";

async function signIn(context: BrowserContext): Promise<void> {
  const value =
    authCookie("browser-private")
      .split(";")[0]
      ?.split("=")
      .slice(1)
      .join("=") ?? "";
  await context.addCookies([
    { name: "oxytype.session_token", value, url: "http://127.0.0.1:4185" },
  ]);
}

test("private routes send guests to login with a return path", async ({
  page,
}) => {
  await page.goto("/account?client=web");
  await expect(page).toHaveURL(/\/login\?redirect=%2Faccount%3Fclient%3Dweb$/);
  await page.goto("/account-settings");
  await expect(page).toHaveURL(/\/login\?redirect=/);
});

test("account and account-settings render for a signed-in account", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.goto("/account-settings?source=mail#top");
  await expect(page).toHaveURL(/\/settings\?tab=account&source=mail#top$/);
  await expect(page.getByText("update account name")).toBeVisible();
  await page.goto("/account");
  await expect(page.getByText("browser-private").first()).toBeVisible();
  await expect(page.getByText("filters", { exact: true })).toBeVisible();
});

test("settings sections are replace-only route search and deep links highlight", async ({
  page,
}) => {
  await page.goto("/settings?tab=caret");
  await expect(page.locator("#group_caret h2")).toBeInViewport();
  await expect(page.locator("#group_behavior")).toBeVisible();
  const length = await page.evaluate(() => history.length);
  await page.getByRole("button", { name: "theme" }).first().click();
  await expect(page).toHaveURL(/\/settings\?tab=theme$/);
  await expect(page.locator("#group_theme h2")).toBeInViewport();
  expect(await page.evaluate(() => history.length)).toBe(length);
  // Guests asking for the account section get behavior.
  await page.goto("/settings?tab=account");
  await expect(page.locator("#group_behavior h2")).toBeInViewport();
  await page.goto("/settings?highlight=quickRestart");
  await expect(
    page.locator('[data-setting-key="quickRestart"].settings-highlight'),
  ).toBeInViewport();
});

test("settings highlights follow search changes on the mounted route", async ({
  page,
}) => {
  await page.goto("/settings?highlight=quickRestart");
  await expect(
    page.locator('[data-setting-key="quickRestart"].settings-highlight'),
  ).toBeVisible();
  await page.getByRole("button", { name: "caret", exact: true }).click();
  const caret = page.locator('[data-setting-key="caretStyle"]');
  await caret.getByRole("button", { name: "Copy link to setting" }).click();
  await expect(page).toHaveURL(/tab=caret&highlight=caretStyle$/);
  await expect(caret).toHaveClass(/settings-highlight/);
  await expect(
    page.locator('[data-setting-key="quickRestart"]'),
  ).not.toHaveClass(/settings-highlight/);
});
