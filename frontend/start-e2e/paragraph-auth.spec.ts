import { completeWords } from "../e2e/fixtures";
import { authCookie } from "./auth-fixtures";
import { expect, test } from "./fixtures";
import { rpcPath } from "./rpc-fixtures";

test("saving a guest test after popup sign-in starts a different paragraph", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("config") === null) {
      localStorage.setItem(
        "config",
        JSON.stringify({
          mode: "words",
          words: 15,
          quickRestart: "off",
          smoothCaret: "off",
        }),
      );
    }
  });
  await page.route("**/api/auth/sign-in/social", async (route) => {
    const body = route.request().postDataJSON() as { callbackURL: string };
    await route.fulfill({
      headers: { "set-cookie": authCookie("browser-paragraph-login") },
      json: { url: body.callbackURL, redirect: false },
    });
  });
  await page.goto("/");
  await expect(page.locator("#words .word")).toHaveCount(15);
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
  const previous = await page.locator("#words .word").allTextContents();
  await completeWords(page);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "sign in with GitHub" }).click();
  const modal = page.getByRole("dialog", { name: "Last signed out result" });
  await expect(modal).toBeVisible();
  const saving = page.waitForResponse(
    (response) => new URL(response.url()).pathname === rpcPath("resultsAdd"),
  );
  await modal.getByRole("button", { name: "save", exact: true }).click();
  expect((await saving).status()).toBe(200);
  await expect(modal).toBeHidden();
  await expect(page.getByText(/Last test result saved/)).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#words .word")).toHaveCount(15);
  await expect(page.locator("#words .word")).not.toHaveText(previous);
});
