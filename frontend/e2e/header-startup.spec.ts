import { toCrossJSONAsync } from "seroval";

import { rpcPath } from "../start-e2e/rpc-fixtures";
import { expect, test } from "./fixtures";

test.use({ config: { theme: "rust" }, reducedMotion: "reduce" });

test("paints the saved theme label before application modules load", async ({
  page,
}, info) => {
  await page.route("**/*.js", async (route) => await route.abort());
  await page.goto("/");
  const label = page.locator('[data-ui-element="startupThemeIndicator"]');
  await expect(label).toBeVisible();
  expect(
    await label.evaluate(
      (element) => getComputedStyle(element, "::before").content,
    ),
  ).toBe('"rust"');
  await page.screenshot({
    path: info.outputPath("header-before-hydration.png"),
  });
});

for (const authenticated of [false, true]) {
  test.describe(authenticated ? "signed-in header" : "guest header", () => {
    test.use({ authenticated });

    test("does not flash sign-in while account data loads", async ({
      page,
    }, info) => {
      let release = (): void => undefined;
      const ready = new Promise<void>((resolve) => {
        release = resolve;
      });
      let requested = false;
      if (authenticated) {
        await page.route(`**${rpcPath("usersGet")}*`, async (route) => {
          requested = true;
          await ready;
          await route.fallback();
        });
      }
      if (!authenticated) {
        await page.route(`**${rpcPath("getSessionState")}*`, async (route) => {
          await route.fulfill({
            contentType: "application/json",
            headers: { "x-tss-serialized": "true" },
            body: JSON.stringify(
              await toCrossJSONAsync({
                result: { user: null, signUpEnabled: true },
                context: {},
              }),
            ),
          });
        });
      }
      try {
        await page.goto("/");
        await expect(page.locator("#words .word").first()).toBeVisible();
        if (authenticated) {
          await expect.poll(() => requested).toBe(true);
          await expect(
            page.getByRole("link", { name: "Sign in", exact: true }),
          ).toHaveCount(0);
          await expect(
            page.locator('[data-ui-element="accountPlaceholder"]'),
          ).toBeVisible();
          await page.screenshot({
            path: info.outputPath("header-account-pending.png"),
          });
          release();
          await expect(page.locator('[data-nav-item="account"]')).toContainText(
            "e2e",
          );
          await expect(
            page.locator('[data-ui-element="accountPlaceholder"]'),
          ).toHaveCount(0);
          await page.reload();
          await expect(page.locator('[data-nav-item="account"]')).toContainText(
            "e2e",
          );
        } else {
          await expect(
            page.getByRole("link", { name: "Sign in", exact: true }),
          ).toBeVisible();
          await expect(
            page.locator('[data-ui-element="accountPlaceholder"]'),
          ).toHaveCount(0);
        }
        await page.screenshot({ path: info.outputPath("header-settled.png") });
      } finally {
        release();
      }
    });
  });
}

test("keeps account navigation available if session lookup fails", async ({
  page,
}) => {
  await page.route(
    `**${rpcPath("getSessionState")}*`,
    async (route) => await route.abort(),
  );
  await page.goto("/");
  await expect(page.locator("#words .word").first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Account", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-ui-element="accountPlaceholder"]'),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveCount(0);
});
