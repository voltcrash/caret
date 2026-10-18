import { rpcPath } from "../__tests__/start/rpc";
import { expect, test } from "./fixtures";

test("startup covers the app with the saved theme until browser setup finishes", async ({
  page,
}) => {
  let release!: () => void;
  let blocked = false;
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documents.push(request.url());
    }
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "themeColors",
      JSON.stringify({ "bg-color": "#123456" }),
    ),
  );
  await page.route("**/assets/browser-runtime.client-*.js", async (route) => {
    blocked = true;
    await held;
    await route.continue();
  });
  const history: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(results|users|presets)(?:[/?]|$)/.test(request.url())) {
      history.push(request.url());
    }
  });
  try {
    await page.goto("/profile/fixture-profile", {
      waitUntil: "domcontentloaded",
    });
    await expect.poll(() => blocked).toBe(true);
    await expect(page.getByText("fixture-profile public bio")).toHaveCount(1);
    await expect(page.locator("#startupScreen")).toBeVisible();
    await expect(page.locator("#app")).toHaveCSS("opacity", "0");
    expect(
      await page
        .locator("html")
        .evaluate((el) => getComputedStyle(el).getPropertyValue("--bg-color")),
    ).toBe("#123456");
    expect(history).toEqual([]);
  } finally {
    release();
  }
  await expect(page.locator("#startupScreen")).toBeHidden();
  await expect(page.locator("#app")).toHaveCSS("opacity", "1");
  await page.getByRole("link", { name: "Oxytype Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.waitForLoadState("networkidle");
  expect(history).toEqual([]);
  expect(documents).toHaveLength(1);
});

test("SSR hydrates Query once and keeps native navigation and refresh working", async ({
  page,
}) => {
  const rpc: string[] = [];
  const documents: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/_serverFn/")) rpc.push(request.url());
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documents.push(request.url());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const response = await page.goto("/profile/fixture-profile");
  expect(response?.status()).toBe(200);
  expect(await response?.text()).toContain("fixture-profile public bio");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("fixture-profile public bio")).toBeVisible();
  await expect(page.locator("#nocss")).toBeHidden();
  expect(rpc.filter((url) => url.includes(rpcPath("getProfile")))).toEqual([]);
  await page.getByRole("link", { name: "Oxytype Home", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/profile\/fixture-profile$/);
  await expect(page.getByText("fixture-profile public bio")).toBeVisible();
  expect(documents).toHaveLength(1);
  expect(rpc.filter((url) => url.includes(rpcPath("getProfile")))).toEqual([]);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("fixture-profile public bio")).toBeVisible();
  expect(errors).toEqual([]);
});

test("the initial response remains useful without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4185/profile/fixture-profile");
    // Playwright's text engine skips <noscript>; assert the rendered DOM instead.
    const warning = page.locator("noscript > div");
    await expect(warning).toBeVisible();
    expect(await warning.textContent()).toContain(
      "Looks like JavaScript is disabled.",
    );
    expect(await page.getByText("fixture-profile public bio").count()).toBe(1);
  } finally {
    await context.close();
  }
});

test("CSS failure retains cache recovery under the production CSP", async ({
  page,
}) => {
  let recoveries = 0;
  await page.exposeFunction("recoveryCalled", () => {
    recoveries++;
  });
  await page.addInitScript(() => {
    navigator.serviceWorker.getRegistrations = async () => {
      (window as unknown as { recoveryCalled: () => void }).recoveryCalled();
      return [];
    };
  });
  await page.route("**/*.css", async (route) => await route.abort());
  await page.goto("/profile");
  await expect(page.locator("#nocss")).toBeVisible();
  const reloaded = page.waitForEvent("framenavigated", {
    predicate: (frame) => frame === page.mainFrame(),
  });
  await page.getByText("Reinstall", { exact: true }).click();
  await reloaded;
  expect(recoveries).toBeGreaterThan(0);
});

test("unknown URLs retain HTTP 404 and popup validation retains its URL", async ({
  page,
}) => {
  const missing = await page.goto("/unknown-route");
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page).toHaveTitle("404 | Oxytype");
  await page.getByRole("link", { name: "Go Home" }).click();
  await expect(page).toHaveURL(/\/$/);
  const popup = await page.goto("/oauth-callback.html");
  expect(popup?.status()).toBe(200);
  await expect(
    page.getByText("Sign-in request not found", { exact: true }),
  ).toBeVisible();
});
