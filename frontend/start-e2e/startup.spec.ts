import { expect, test } from "../e2e/fixtures";

// Hold real downloads, including on repeat visits.
test.use({
  authenticated: true,
  startSession: "browser-typing",
  serviceWorkers: "block",
});

for (const showTestModesNotice of [false, true]) {
  test.describe(`startup with test mode notices ${showTestModesNotice ? "shown" : "hidden"}`, () => {
    test.use({
      config: {
        mode: "words",
        words: 15,
        quickRestart: "off",
        smoothCaret: "off",
        showTestModesNotice,
        showAverage: "both",
      },
    });

    for (const target of [
      { name: "typing code", pattern: "**/assets/page.client-*.js" },
      { name: "test language", pattern: "**/languages/english.json*" },
    ]) {
      test(`keeps the logo until ${target.name} is ready`, async ({ page }) => {
        const pending = Promise.withResolvers<undefined>();
        let blocked = false;
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route(target.pattern, async (route) => {
          blocked = true;
          await pending.promise;
          await route.continue();
        });
        try {
          await page.goto("/", { waitUntil: "domcontentloaded" });
          await expect.poll(() => blocked).toBe(true);
          await expect(page.locator("#solidmodals")).toHaveCount(1);
          await page.waitForFunction(() => {
            const config = (
              window as unknown as { config?: { showAverage: string } }
            ).config;
            return config?.showAverage === "both";
          });
          // A premature reveal would finish its 150ms exit fade during this hold.
          await page.waitForTimeout(300);
          await expect(page.locator("#startupScreen")).toBeVisible();
          await expect(page.locator("#app")).toHaveCSS("opacity", "0");
        } finally {
          pending.resolve(undefined);
        }
        await expect(page.locator("#words .word").first()).toBeVisible();
        await expect(page.locator("#startupScreen")).toHaveCount(0);
        await expect(page.locator("#app")).toHaveCSS("opacity", "1");
        await expect(
          page.getByText("Loading typing test…", { exact: true }),
        ).toHaveCount(0);
        expect(errors).toEqual([]);
      });
    }
  });
}

test.describe("startup with signed-in summaries", () => {
  test.use({
    config: {
      mode: "words",
      words: 15,
      quickRestart: "off",
      smoothCaret: "off",
      showTestModesNotice: true,
      showAverage: "both",
    },
  });

  test("reveals the test while optional notice chunks are pending", async ({
    page,
  }) => {
    const pending = Promise.withResolvers<undefined>();
    const blocked = new Set<string>();
    for (const name of ["AverageNotice", "TagsNotice"]) {
      await page.route(`**/assets/${name}-*.js`, async (route) => {
        blocked.add(name);
        await pending.promise;
        await route.continue();
      });
    }
    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect.poll(() => blocked.size).toBe(2);
      await expect(page.locator("#startupScreen")).toHaveCount(0);
      await expect(page.locator("#words .word").first()).toBeVisible();
      await expect(
        page.getByText("Loading typing test…", { exact: true }),
      ).toHaveCount(0);
    } finally {
      pending.resolve(undefined);
    }
    await expect(
      page.getByRole("button", { name: "no average", exact: true }),
    ).toBeVisible();
  });

  test("reveals the initialization error when language loading fails", async ({
    page,
  }) => {
    await page.route("**/languages/english.json*", async (route) =>
      route.abort("failed"),
    );
    await page.goto("/");
    await expect(page.locator("#startupScreen")).toHaveCount(0);
    await expect(page.locator("#testInitFailed")).toBeVisible();
    await expect(page.locator("#app")).toHaveCSS("opacity", "1");
  });

  test("keeps the app visible when leaving and returning to the test", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("#startupScreen")).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Settings", exact: true })
      .click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator("#startupScreen")).toHaveCount(0);
    await expect(page.locator("#app")).toHaveCSS("opacity", "1");
    await page.getByRole("link", { name: "Oxytype Home", exact: true }).click();
    await expect(page.locator("#words .word").first()).toBeVisible();
    await expect(page.locator("#startupScreen")).toHaveCount(0);
    await expect(page.locator("#app")).toHaveCSS("opacity", "1");
  });
});
