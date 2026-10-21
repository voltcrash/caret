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
