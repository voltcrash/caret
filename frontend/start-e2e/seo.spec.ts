import { expect, test } from "./fixtures";

test("homepage links to the about page without showing the product overview", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#startupScreen")).toBeHidden();
  await expect(page.locator("#about-caret")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Caret typing test",
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("#wordsInput")).toBeFocused();
  await page.screenshot({
    path: test.info().outputPath("typing-home.png"),
    fullPage: true,
  });
  const about = page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "About Caret", exact: true });
  await expect(about).toBeInViewport();
  await expect(about.locator(".fa-circle-info")).toBeVisible();
  await about.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "About Caret",
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  await page.screenshot({
    path: test.info().outputPath("about-caret.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Start a free typing test" }).click();
  await expect(page.locator("#wordsInput")).toBeFocused();
  await page.locator("#wordsInput").evaluate((element) => element.blur());
  await page.keyboard.press("a");
  await expect(page.locator("#wordsInput")).toBeFocused();
});

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
  const about = page.getByRole("link", { name: "About Caret", exact: true });
  await expect(about).toBeInViewport();
  await about.click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page).toHaveTitle(
    "About Caret | Free Typing Test & Online Typing Practice",
  );
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://caret.voltcrash.com/about",
  );
  await expect(page.locator('head meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://caret.voltcrash.com/about",
  );
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(
    1,
  );
  await expect
    .poll(
      async () =>
        await page.locator('script[type="application/ld+json"]').textContent(),
    )
    .toContain("FAQPage");
  await page.getByRole("link", { name: "Browse typing guides" }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Typing guides",
  );
  await expect(page).toHaveTitle("Typing Guides | Caret");
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(
    0,
  );
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://caret.voltcrash.com/guide",
  );
  await page.screenshot({
    path: test.info().outputPath("typing-guides.png"),
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "How to practice typing and build accuracy" })
    .click();
  await expect(page).toHaveURL(/\/guide\/typing-practice$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "How to practice typing",
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath("typing-guide.png") });
  await expect(page).toHaveTitle("How to practice typing | Caret");
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://caret.voltcrash.com/guide/typing-practice",
  );
  await expect(page.locator('head meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://caret.voltcrash.com/guide/typing-practice",
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
  await expect
    .poll(
      async () =>
        await page.locator('script[type="application/ld+json"]').textContent(),
    )
    .toContain('"@type":"Article"');
  await page
    .getByRole("navigation", { name: "Breadcrumb" })
    .getByRole("link", { name: "Guides", exact: true })
    .click();
  await expect(page).toHaveURL(/\/guide$/);
  await page
    .getByRole("link", {
      name: "How to test your typing speed and understand WPM",
    })
    .click();
  await expect(page).toHaveURL(/\/guide\/typing-speed-test$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Typing speed test: WPM and accuracy",
  );
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
  await page.goto("/guide/typing-for-programmers");
  await expect(page.locator("#startupScreen")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: test.info().outputPath("typing-guide-mobile.png"),
  });
  await page.getByRole("link", { name: "Start a free typing test" }).click();
  await expect(page.locator("#about-caret")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Caret typing test",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: test.info().outputPath("typing-home-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "About Caret", exact: true }).click();
  await expect(page.locator("#about-caret")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: test.info().outputPath("about-caret-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(
    page.getByRole("link", { name: "About Caret", exact: true }),
  ).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page.getByRole("link", { name: "Browse typing guides" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Typing guides",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page.screenshot({
    path: test.info().outputPath("typing-guides-mobile.png"),
    fullPage: true,
  });
});

test("new guides load through client navigation with matching Article metadata", async ({
  page,
}) => {
  await page.goto("/guide");
  for (const guide of [
    {
      slug: "wpm-calculator",
      title: "WPM calculator: characters, time and typing speed",
    },
    {
      slug: "how-to-type-faster",
      title: "How to type faster without losing accuracy",
    },
    {
      slug: "average-typing-speed",
      title: "Average typing speed: compare WPM fairly",
    },
  ]) {
    await page.locator(`a[href="/guide/${guide.slug}"]`).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      guide.title,
    );
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
      "href",
      `https://caret.voltcrash.com/guide/${guide.slug}`,
    );
    await expect
      .poll(
        async () =>
          await page
            .locator('script[type="application/ld+json"]')
            .textContent(),
      )
      .toContain('"@type":"Article"');
    await page
      .getByRole("navigation", { name: "Breadcrumb" })
      .getByRole("link", { name: "Guides", exact: true })
      .click();
    await expect(page).toHaveURL(/\/guide$/);
  }
});

test("static CSS recovery still works after the content", async ({ page }) => {
  await page.route("**/*.css", async (route) => await route.abort());
  await page.goto("/about");
  await expect(page.locator("#nocss")).toBeVisible();
  await expect(page.locator("#nocss")).toContainText(
    "It seems like the CSS failed to load",
  );
});
