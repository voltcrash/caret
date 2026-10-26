import { authCookie } from "./auth-fixtures";
import { expect, test } from "./fixtures";

// Hold actual downloads rather than receiving assets from the service worker.
test.use({ serviceWorkers: "block" });

test("settings keep their loading layout while the browser bundle downloads", async ({
  page,
}) => {
  const bundle = Promise.withResolvers<undefined>();
  let blocked = false;
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documents.push(request.url());
    }
  });
  await page.route("**/assets/content.client-*.js", async (route) => {
    blocked = true;
    await bundle.promise;
    await route.continue();
  });
  const loading = page.getByRole("status", { name: "Loading settings" });
  try {
    await page.goto("/profile/fixture-profile");
    await expect(page.locator("#startupScreen")).toBeHidden();
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await expect.poll(() => blocked).toBe(true);
    await expect(loading).toBeVisible();
    await expect(loading).toHaveAttribute("aria-busy", "true");
    await expect(loading.getByText("loading your preferences…")).toBeVisible();
    const sidebar = loading.locator("[data-settings-sidebar-skeleton]");
    await expect(sidebar.locator('[aria-hidden="true"]').first()).toBeVisible();
    await expect(
      sidebar.locator("[data-settings-section-skeleton]"),
    ).toHaveCount(8);
    await expect(sidebar.getByText("appearance", { exact: true })).toBeHidden();
    await expect(sidebar.locator("input, button, a, [tabindex]")).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("navigation", { name: "Page sections" }),
    ).toHaveCount(0);
    await expect(page.locator("#group_behavior")).toHaveCount(0);
    await page.screenshot({
      path: test.info().outputPath("settings-loading.png"),
    });
  } finally {
    bundle.resolve(undefined);
  }
  await expect(loading).toBeHidden();
  await expect(
    page.getByRole("textbox", { name: "Search settings" }),
  ).toBeVisible();
  await expect(page.locator("#group_behavior h2")).toBeInViewport();
  expect(documents).toHaveLength(1);
});

for (const { authenticated, mobile } of [
  { authenticated: false, mobile: false },
  { authenticated: true, mobile: false },
  { authenticated: false, mobile: true },
]) {
  const section = mobile ? "behavior" : "caret";
  const name = `${authenticated ? "signed-in" : "guest"}-${mobile ? "mobile" : "desktop"}`;
  test(`the ${name} settings replace the loading layout without moving`, async ({
    page,
    context,
  }) => {
    if (authenticated) {
      const value =
        authCookie("browser-private")
          .split(";")[0]
          ?.split("=")
          .slice(1)
          .join("=") ?? "";
      await context.addCookies([
        { name: "caret.session_token", value, url: "http://127.0.0.1:4185" },
      ]);
    }
    await page.setViewportSize(
      mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    );
    const bundle = Promise.withResolvers<undefined>();
    let blocked = false;
    await page.route("**/assets/content.client-*.js", async (route) => {
      blocked = true;
      await bundle.promise;
      await route.continue();
    });
    const loading = page.getByRole("status", { name: "Loading settings" });
    type Box = { x: number; y: number; width: number; height: number } | null;
    const boxes = async (): Promise<
      Record<"heading" | "item" | "search" | "sidebar", Box>
    > => ({
      heading: await page.getByRole("heading", { name: section }).boundingBox(),
      item: await loading
        .locator('[data-settings-section-skeleton="appearance"] > :last-child')
        .boundingBox(),
      search: await loading
        .locator("[data-settings-search-skeleton]")
        .boundingBox(),
      sidebar: await loading
        .locator("[data-settings-sidebar-skeleton] > div > div")
        .boundingBox(),
    });
    let before: Awaited<ReturnType<typeof boxes>>;
    try {
      await page.goto(mobile ? "/settings" : "/settings?tab=caret");
      await expect.poll(() => blocked).toBe(true);
      await expect(page.locator("#startupScreen")).toBeHidden();
      await expect(loading).toBeVisible();
      await expect(
        loading.locator("[data-settings-section-skeleton]"),
      ).toHaveCount(authenticated ? 9 : 8);
      before = await boxes();
      await page.screenshot({
        path: test.info().outputPath(`settings-loading-${name}.png`),
      });
    } finally {
      bundle.resolve(undefined);
    }
    await expect(loading).toBeHidden();
    const search = page.getByRole("textbox", { name: "Search settings" });
    await expect(search).toBeInViewport();
    const after = {
      heading: await page.locator(`#group_${section} h2`).boundingBox(),
      item: await page
        .getByRole("navigation", { name: "Page sections" })
        .getByRole("button", { name: "appearance" })
        .locator("span")
        .boundingBox(),
      search: await search.boundingBox(),
      sidebar: await page
        .getByRole("navigation", { name: "Page sections" })
        .boundingBox(),
    };
    await page.screenshot({
      path: test.info().outputPath(`settings-loaded-${name}.png`),
    });
    for (const key of ["heading", "item", "search", "sidebar"] as const) {
      expect(before[key]).not.toBeNull();
      expect(after[key]).not.toBeNull();
      expect(
        Math.abs((before[key]?.x ?? 0) - (after[key]?.x ?? 0)),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs((before[key]?.y ?? 0) - (after[key]?.y ?? 0)),
      ).toBeLessThanOrEqual(1);
    }
    for (const key of ["width", "height"] as const) {
      expect(
        Math.abs((before.sidebar?.[key] ?? 0) - (after.sidebar?.[key] ?? 0)),
      ).toBeLessThanOrEqual(1);
    }
  });
}

test.describe("mobile with reduced motion", () => {
  test.use({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });

  test("the server loading layout fits mobile and keeps deep links after loading", async ({
    page,
  }) => {
    const bundle = Promise.withResolvers<undefined>();
    let blocked = false;
    await page.route("**/assets/content.client-*.js", async (route) => {
      blocked = true;
      await bundle.promise;
      await route.continue();
    });
    const loading = page.getByRole("status", { name: "Loading settings" });
    try {
      const response = await page.goto("/settings?tab=caret", {
        waitUntil: "domcontentloaded",
      });
      expect(await response?.text()).toContain('aria-label="Loading settings"');
      await expect.poll(() => blocked).toBe(true);
      await expect(page.locator("#startupScreen")).toBeHidden();
      await expect(loading).toBeVisible();
      await expect(page.locator("#group_caret")).toHaveCount(0);
      const sidebar = loading.locator("[data-settings-sidebar-skeleton]");
      await expect(sidebar).toBeInViewport();
      await expect(sidebar.getByText(/tip:/)).toHaveCount(0);
      const items = sidebar.locator("[data-settings-section-skeleton]");
      const first = await items.nth(0).boundingBox();
      const second = await items.nth(1).boundingBox();
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(first?.y).toBe(second?.y);
      expect(first?.x).toBeLessThan(second?.x ?? 0);
      const animations = await loading.evaluate((element) =>
        [...element.querySelectorAll("*")].map(
          (child) => getComputedStyle(child).animationName,
        ),
      );
      expect(animations.every((animation) => animation === "none")).toBe(true);
      expect(
        await loading.evaluate((element) => element.scrollWidth),
      ).toBeLessThanOrEqual(390);
      await page.screenshot({
        path: test.info().outputPath("settings-loading-mobile.png"),
      });
    } finally {
      bundle.resolve(undefined);
    }
    await expect(loading).toBeHidden();
    await expect(page.locator("#group_caret h2")).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  });
});
