import { expect, test } from "./fixtures";

test("typing guides preserve the test layout and update metadata on client navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documents.push(request.url());
    }
  });
  await page.goto("/");
  await expect(page.locator("#startupScreen")).toBeHidden();
  await expect(page.locator("#words .word").first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("typing-home.png") });
  const overview = page.getByRole("region", {
    name: "Caret: free typing test and online typing practice",
  });
  const bounds = await overview.boundingBox();
  expect(bounds?.y).toBeGreaterThanOrEqual(page.viewportSize()?.height ?? 0);
  await overview.scrollIntoViewIfNeeded();
  await expect(overview).toBeVisible();
  await overview
    .getByRole("link", { name: "How to practice typing and build accuracy" })
    .click();
  await expect(page).toHaveURL(/\/typing-practice$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "How to practice typing",
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath("typing-guide.png") });
  await expect(page).toHaveTitle("How to practice typing | Caret");
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://caret.voltcrash.com/typing-practice",
  );
  await expect(page.locator('head meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://caret.voltcrash.com/typing-practice",
  );
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(
    1,
  );
  await expect
    .poll(
      async () =>
        await page.locator('script[type="application/ld+json"]').textContent(),
    )
    .toContain("BreadcrumbList");
  await page.getByRole("link", { name: "Start a free typing test" }).click();
  await expect(page.locator("#words .word").first()).toBeVisible();
  await expect(page).toHaveTitle(
    "Caret | Free Typing Test & Online Typing Practice",
  );
  await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(
    1,
  );
  await expect
    .poll(
      async () =>
        await page.locator('script[type="application/ld+json"]').textContent(),
    )
    .toContain("WebApplication");
  expect(documents).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("typing guides and product content fit a narrow screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/typing-for-programmers");
  await expect(page.locator("#startupScreen")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: test.info().outputPath("typing-guide-mobile.png"),
  });
  await page.getByRole("link", { name: "Start a free typing test" }).click();
  const overview = page.locator("#about-caret");
  await overview.scrollIntoViewIfNeeded();
  await expect(overview).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});
