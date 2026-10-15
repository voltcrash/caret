import { expect, test } from "playwright/test";
import { authCookie } from "./auth-fixtures";

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
  await page.getByRole("link", { name: "about", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect
    .poll(
      async () =>
        await (await page.request.get("/api/auth/get-session")).text(),
    )
    .toBe("null");
});
