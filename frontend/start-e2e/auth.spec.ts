import { expect, test } from "./fixtures";
import { authCookie } from "./auth-fixtures";

test("navigation preload consumes OAuth callback state only once", async ({
  page,
}) => {
  await page.goto("/login");
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
    const registration = await navigator.serviceWorker.ready;
    await registration.navigationPreload.enable();
  });
  await page.evaluate(async () => {
    const callbackURL = `${location.origin}/oauth-callback.html?requestId=preload-regression`;
    const response = await fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "github",
        callbackURL,
        errorCallbackURL: callbackURL,
        disableRedirect: true,
      }),
    });
    if (!response.ok) throw new Error("OAuth initiation failed");
    const { url } = (await response.json()) as { url: string };
    const state = new URL(url).searchParams.get("state");
    if (state === null || state === "") throw new Error("OAuth state missing");
    // A provider denial exercises real state/cookies without calling GitHub.
    location.assign(
      `/api/auth/callback/github?error=access_denied&state=${encodeURIComponent(state)}`,
    );
  });
  await expect(page).toHaveURL(
    /\/oauth-callback\.html\?requestId=preload-regression&error=access_denied$/,
  );
  await expect(page.getByText("access_denied", { exact: true })).toBeVisible();
  const cachedPaths = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys()).map(async (name) =>
          (await (await caches.open(name)).keys()).map(
            (request) => new URL(request.url).pathname,
          ),
        ),
      )
    ).flat(),
  );
  expect(cachedPaths.some((path) => path.startsWith("/api/"))).toBe(false);
});

test("popup login and logout update native routes without reloading the document", async ({
  page,
}) => {
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documents.push(request.url());
    }
  });
  await page.route("**/api/auth/sign-in/social", async (route) => {
    const body = route.request().postDataJSON() as { callbackURL: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "set-cookie": authCookie("browser-login") },
      body: JSON.stringify({ url: body.callbackURL, redirect: false }),
    });
  });
  await page.goto("/login?redirect=/login");
  await page.getByRole("button", { name: "sign in with GitHub" }).click();
  await expect(page.getByText("Signed in as a", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "sign in with GitHub" }),
  ).toBeVisible();
  expect(documents).toHaveLength(1);
});

for (const [path, token] of [
  ["/account", "browser-logout"],
  ["/", "browser-home"],
] as const) {
  test(`header sign-out on ${path} clears private data and keeps the guest page usable`, async ({
    page,
    context,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const value =
      authCookie(token).split(";")[0]?.split("=").slice(1).join("=") ?? "";
    await context.addCookies([
      { name: "oxytype.session_token", value, url: "http://127.0.0.1:4185" },
    ]);
    await page.goto(path);
    if (path === "/account") {
      await expect(page.getByText("filters", { exact: true })).toBeVisible();
    } else {
      await expect(page.locator("#words .word").first()).toBeVisible();
    }
    await page.getByRole("link", { name: "Account", exact: true }).hover();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    if (path === "/account") {
      await expect(page).toHaveURL(/\/login\?redirect=%2Faccount$/);
      await expect(
        page.getByRole("button", { name: "sign in with GitHub" }),
      ).toBeVisible();
    } else {
      await expect(
        page.getByRole("link", { name: "Sign in", exact: true }),
      ).toBeVisible();
      const word = page.locator("#words .word").first();
      const letter = (await word.textContent())?.[0] ?? "";
      expect(letter).not.toBe("");
      await word.click();
      await page.keyboard.type(letter);
      await expect(page.locator("#words letter.correct")).toHaveCount(1);
    }
    await expect(page.getByText(/Failed to get user data/)).toHaveCount(0);
    await expect(page.getByText("Unable to load Oxytype")).toHaveCount(0);
    expect(await (await page.request.get("/api/auth/get-session")).text()).toBe(
      "null",
    );
    expect(errors).toEqual([]);
  });
}

test("session expiry removes private controls while the current document stays mounted", async ({
  page,
  context,
}) => {
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documents.push(request.url());
    }
  });
  const value =
    authCookie("browser-expiry").split(";")[0]?.split("=").slice(1).join("=") ??
    "";
  await context.addCookies([
    { name: "oxytype.session_token", value, url: "http://127.0.0.1:4185" },
  ]);
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "sign out", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await fetch("/api/auth/sign-out", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    window.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByRole("button", { name: "sign in with GitHub" }),
  ).toBeVisible();
  expect(documents).toHaveLength(1);
});

test("unfinished signup cancellation preserves the native login flow", async ({
  page,
  context,
}) => {
  const value =
    authCookie("browser-pending")
      .split(";")[0]
      ?.split("=")
      .slice(1)
      .join("=") ?? "";
  await context.addCookies([
    { name: "oxytype.session_token", value, url: "http://127.0.0.1:4185" },
  ]);
  await page.goto("/login");
  await page.getByRole("button", { name: "cancel sign up" }).click();
  await expect(
    page.getByRole("button", { name: "sign in with GitHub" }),
  ).toBeVisible();
});

test("leaving incomplete signup cancels its session without changing the document", async ({
  page,
  context,
}) => {
  const value =
    authCookie("browser-dismissal")
      .split(";")[0]
      ?.split("=")
      .slice(1)
      .join("=") ?? "";
  await context.addCookies([
    { name: "oxytype.session_token", value, url: "http://127.0.0.1:4185" },
  ]);
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "cancel sign up" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "About", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect
    .poll(
      async () =>
        await (await page.request.get("/api/auth/get-session")).text(),
    )
    .toBe("null");
});
