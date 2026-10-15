import { rpcPath } from "../__tests__/start/rpc";
import { expect, test } from "playwright/test";

test("public navigation and the saved theme work while browser setup is loading", async ({
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
    await page.goto("/about", { waitUntil: "domcontentloaded" });
    await expect.poll(() => blocked).toBe(true);
    await expect(page.getByTestId("tests-completed")).toHaveText("11");
    expect(
      await page
        .locator("html")
        .evaluate((el) => getComputedStyle(el).getPropertyValue("--bg-color")),
    ).toBe("#123456");
    await page.getByRole("link", { name: "oxytype", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(history).toEqual([]);
    expect(documents).toHaveLength(1);
  } finally {
    release();
  }
  await page.waitForLoadState("networkidle");
  expect(history).toEqual([]);
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
  const response = await page.goto("/about");
  expect(response?.status()).toBe(200);
  expect(await response?.text()).toContain('data-testid="tests-completed">11');
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("tests-completed")).toHaveText("11");
  await expect(page.locator("#nocss")).toBeHidden();
  expect(rpc.filter((url) => url.includes(rpcPath("getTypingStats")))).toEqual(
    [],
  );
  await page.getByRole("link", { name: "oxytype", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole("link", { name: "About Oxytype", exact: true }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByTestId("tests-completed")).toHaveText("11");
  expect(documents).toHaveLength(1);
  expect(rpc.filter((url) => url.includes(rpcPath("getTypingStats")))).toEqual(
    [],
  );
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("tests-completed")).toHaveText("11");
  expect(errors).toEqual([]);
});

test("the initial response remains useful without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4185/about");
    // Playwright's text engine skips <noscript>; assert the rendered DOM instead.
    const warning = page.locator("noscript > div");
    await expect(warning).toBeVisible();
    expect(await warning.textContent()).toContain(
      "Looks like JavaScript is disabled.",
    );
    expect(await page.getByTestId("tests-completed").textContent()).toBe("11");
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
  await page.goto("/about");
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
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  const popup = await page.goto("/oauth-callback.html");
  expect(popup?.status()).toBe(200);
  await expect(
    page.getByText("Sign-in request not found", { exact: true }),
  ).toBeVisible();
});
