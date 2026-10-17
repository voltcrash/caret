import { authCookie } from "./auth-fixtures";
import { expect, test } from "./fixtures";

test("one online visit installs guest typing; private documents and RPCs stay uncached", async ({
  page,
  context,
}) => {
  const value =
    authCookie("browser-private")
      .split(";")[0]
      ?.split("=")
      .slice(1)
      .join("=") ?? "";
  await context.addCookies([
    { name: "oxytype.session_token", value, url: "http://127.0.0.1:4185" },
  ]);
  const signOuts: string[] = [];
  context.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/auth/sign-out") {
      signOuts.push(request.url());
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
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account$/);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open(
      names.find((name) => name.startsWith("oxytype-start-")) ?? "missing",
    );
    const keys = (await cache.keys()).map(
      (request) => new URL(request.url).pathname,
    );
    const shell = await cache.match("/");
    return { keys, shell: await shell?.text() };
  });
  expect(cached.keys).toContain("/");
  expect(cached.keys).not.toContain("/account");
  expect(
    cached.keys.some(
      (path) => path.startsWith("/api/") || path.startsWith("/_serverFn/"),
    ),
  ).toBe(false);
  expect(cached.shell).not.toContain("browser-private");
  expect(cached.shell).not.toContain("e2e@example.test");
  await context.setOffline(true);
  const privatePage = await page.goto("/account");
  expect(privatePage?.status()).toBe(503);
  await expect(
    page.getByRole("heading", { name: "You're offline" }),
  ).toBeVisible();
  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(50, 52, 55)",
  );
  await page.getByRole("link", { name: "Start typing" }).click();
  await expect(page.locator("#words .word").first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toBeVisible();
  const word = page.locator("#words .word").first();
  const letter = (await word.textContent())?.[0] ?? "";
  expect(letter).not.toBe("");
  await word.click();
  await page.keyboard.type(letter);
  await expect(page.locator("#words letter.correct")).toHaveCount(1);
  // Losing the network never ends the session.
  await context.setOffline(false);
  expect(signOuts).toEqual([]);
  const session = await page.request.get("/api/auth/get-session");
  expect(await session.text()).not.toBe("null");
});
