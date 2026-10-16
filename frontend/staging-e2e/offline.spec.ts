import { expect, test } from "playwright/test";

test("hosted Worker supports offline guest typing with a script-free private fallback", async ({
  page,
  context,
}) => {
  // Hosted Cloudflare supplies the client IP; never send local fixture headers.
  await page.addInitScript(() => {
    localStorage.setItem(
      "acceptedCookies",
      JSON.stringify({ security: false, analytics: false, sentry: false }),
    );
  });
  const cspErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text().includes("Content Security Policy")
    ) {
      cspErrors.push(message.text());
    }
  });
  await page.goto("/");
  await expect(page.locator("#words .word").first()).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
    }
  });
  await context.setOffline(true);
  const privatePage = await page.goto("/account");
  expect(privatePage?.status()).toBe(503);
  expect(privatePage?.headers()["content-security-policy"]).toContain(
    "style-src 'self'",
  );
  await expect(
    page.getByRole("heading", { name: "You're offline" }),
  ).toBeVisible();
  expect(await page.locator("script").count()).toBe(0);
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(50, 52, 55)",
  );
  await page.getByRole("link", { name: "Start typing" }).click();
  const word = page.locator("#words .word").first();
  await expect(word).toBeVisible();
  const letter = (await word.textContent())?.[0] ?? "";
  expect(letter).not.toBe("");
  await word.click();
  await page.keyboard.type(letter);
  await expect(page.locator("#words letter.correct")).toHaveCount(1);
  expect(cspErrors).toEqual([]);
});
