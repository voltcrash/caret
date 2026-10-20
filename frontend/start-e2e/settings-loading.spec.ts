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

test("the loaded settings replace the loading layout without moving", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const bundle = Promise.withResolvers<undefined>();
  let blocked = false;
  await page.route("**/assets/content.client-*.js", async (route) => {
    blocked = true;
    await bundle.promise;
    await route.continue();
  });
  const loading = page.getByRole("status", { name: "Loading settings" });
  type Box = { x: number; y: number } | null;
  const boxes = async (): Promise<
    Record<"heading" | "item" | "search", Box>
  > => ({
    heading: await page.getByRole("heading", { name: "caret" }).boundingBox(),
    item: await loading
      .locator('[data-settings-section-skeleton="appearance"] > :last-child')
      .boundingBox(),
    search: await loading
      .locator("[data-settings-search-skeleton]")
      .boundingBox(),
  });
  let before: Awaited<ReturnType<typeof boxes>>;
  try {
    await page.goto("/settings?tab=caret");
    await expect.poll(() => blocked).toBe(true);
    await expect(page.locator("#startupScreen")).toBeHidden();
    await expect(loading).toBeVisible();
    before = await boxes();
    await page.screenshot({
      path: test.info().outputPath("settings-loading-desktop.png"),
    });
  } finally {
    bundle.resolve(undefined);
  }
  await expect(loading).toBeHidden();
  const search = page.getByRole("textbox", { name: "Search settings" });
  await expect(search).toBeVisible();
  const after = {
    heading: await page.locator("#group_caret h2").boundingBox(),
    item: await page
      .getByRole("navigation", { name: "Page sections" })
      .getByRole("button", { name: "appearance" })
      .locator("span")
      .boundingBox(),
    search: await search.boundingBox(),
  };
  await page.screenshot({
    path: test.info().outputPath("settings-loaded-desktop.png"),
  });
  for (const key of ["heading", "item", "search"] as const) {
    expect(before[key]).not.toBeNull();
    expect(after[key]).not.toBeNull();
    expect(
      Math.abs((before[key]?.x ?? 0) - (after[key]?.x ?? 0)),
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs((before[key]?.y ?? 0) - (after[key]?.y ?? 0)),
    ).toBeLessThanOrEqual(1);
  }
});

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
  });
});
