import type { Route } from "playwright/test";
import { expect, test } from "./fixtures";

test("the website cannot accept typing before its Wasm engine is ready", async ({
  page,
}) => {
  const download = Promise.withResolvers<Route>();
  await page.route("**/*.wasm", (route) => {
    download.resolve(route);
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const request = await download.promise;
  await expect(page.locator("#wordsInput")).toBeDisabled();
  await expect(page.locator("#words .word")).toHaveCount(0);
  await request.continue();
  await expect(page.locator("#wordsInput")).toBeEnabled();
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
  const word = page.locator("#words .word").first();
  await word.click();
  const character = (await word.textContent())?.[0];
  if (character === undefined) throw new Error("Missing prepared word");
  await page.keyboard.type(character);
  await expect(word.locator("letter.correct")).toHaveCount(1);
});

test("a failed engine download shows the existing failure UI and Restart retries", async ({
  page,
}) => {
  await page.route("**/*.wasm", async (route) => {
    await route.fulfill({ status: 503, body: "engine unavailable" });
  });
  await page.goto("/");
  await expect(page.locator("#testInitFailed")).toBeVisible();
  await expect(page.locator("#testInitFailed")).toContainText(
    "Typing engine download failed: 503",
  );
  await expect(page.locator("#wordsInput")).toBeDisabled();
  await page.unroute("**/*.wasm");
  await page
    .locator("#testInitFailed")
    .getByRole("button", { name: "Restart", exact: true })
    .click();
  await expect(page.locator("#testInitFailed")).toBeHidden();
  await expect(page.locator("#wordsInput")).toBeEnabled();
  await expect(page.locator("#words .word").first()).toBeVisible();
});
