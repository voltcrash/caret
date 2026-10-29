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
      test(`shows a stable shell while ${target.name} is pending`, async ({
        page,
      }) => {
        const pending = Promise.withResolvers<undefined>();
        let blocked = false;
        const errors: string[] = [];
        const backendRequests: string[] = [];
        page.on("request", (request) => {
          const path = new URL(request.url()).pathname;
          if (path.startsWith("/_serverFn/") || path.startsWith("/api/")) {
            backendRequests.push(path);
          }
        });
        page.on("pageerror", (error) => errors.push(error.message));
        await page.route(target.pattern, async (route) => {
          blocked = true;
          await pending.promise;
          await route.continue();
        });
        try {
          await page.goto("/", { waitUntil: "domcontentloaded" });
          await expect.poll(() => blocked).toBe(true);
          await expect(
            page.locator('[data-ui-element="header"]'),
          ).toBeVisible();
          await expect(
            page.getByRole("navigation", { name: "Main navigation" }),
          ).toBeVisible();
          await expect(page.locator("#solidmodals")).toHaveCount(0);
          expect(backendRequests).toEqual([]);
          await expect(page.locator("#startupScreen")).toHaveCount(0);
          await expect(page.locator("#app")).toHaveCSS("opacity", "1");
          await expect(page.locator("[data-initial-typing]")).toBeVisible();
          await expect(
            page.locator("[data-initial-words] .word").first(),
          ).toBeVisible();
          await expect(
            page.getByRole("textbox", { name: "Typing input" }),
          ).not.toBeVisible();
        } finally {
          pending.resolve(undefined);
        }
        await expect(page.locator("#words .word").first()).toBeVisible();
        await expect(page.locator("#startupScreen")).toHaveCount(0);
        await expect(page.locator("#app")).toHaveCSS("opacity", "1");
        await expect(
          page.getByText("Loading typing test…", { exact: true }),
        ).toHaveCount(0);
        await expect(page.locator("[data-initial-typing]")).toHaveCount(0);
        await expect(
          page.getByRole("textbox", { name: "Typing input" }),
        ).toBeEnabled();
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
    await page.getByRole("link", { name: "Caret Home", exact: true }).click();
    await expect(page.locator("#words .word").first()).toBeVisible();
    await expect(page.locator("#startupScreen")).toHaveCount(0);
    await expect(page.locator("#app")).toHaveCSS("opacity", "1");
  });
});

test("typing becomes usable while all backend requests are held", async ({
  page,
}, info) => {
  const pending = Promise.withResolvers<undefined>();
  const requests: string[] = [];
  await page.route("**/_serverFn/**", async (route) => {
    requests.push(route.request().url());
    await pending.promise;
    await route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const word = page.locator("#words .word").first();
    await expect(word).toBeVisible();
    await expect(page.locator("[data-initial-typing]")).toHaveCount(0);
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    const first = (await word.textContent())?.[0];
    if (first === undefined) throw new Error("Missing test word");
    await word.click();
    await page.keyboard.type(first);
    await expect(word.locator("letter.correct")).toHaveCount(1);
    await page.screenshot({
      path: info.outputPath("typing-with-backend-pending.png"),
    });
  } finally {
    pending.resolve(undefined);
  }
});

test("server shell remains visible when JavaScript cannot download", async ({
  page,
}, info) => {
  await page.route("**/assets/*.js", async (route) => await route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-ui-element="header"]')).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#app")).toHaveCSS("opacity", "1");
  await expect(page.locator("#startupScreen")).toHaveCount(0);
  await expect(page.locator("[data-initial-typing]")).toBeVisible();
  await expect(
    page.locator("[data-initial-words] .word").first(),
  ).toBeVisible();
  await expect(page.getByText("Preparing typing test…")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("server-shell.png") });
});

test.describe("touch startup", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test("keeps navigation stable and opens the keyboard only after a tap", async ({
    page,
  }, info) => {
    const pending = Promise.withResolvers<undefined>();
    await page.route("**/languages/english.json*", async (route) => {
      await pending.promise;
      await route.continue();
    });
    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-initial-typing]")).toBeVisible();
      const header = page.locator('[data-ui-element="header"]');
      let initialHeight = 0;
      await expect
        .poll(async () => {
          initialHeight = await header.evaluate(
            (element) => element.getBoundingClientRect().height,
          );
          return initialHeight;
        })
        .toBeGreaterThan(0);
      await page.screenshot({ path: info.outputPath("touch-shell.png") });
      pending.resolve(undefined);
      await expect(page.locator("#words .word").first()).toBeVisible();
      await expect(page.locator("#wordsInput")).not.toBeFocused();
      await expect
        .poll(
          async () =>
            await header.evaluate(
              (element) => element.getBoundingClientRect().height,
            ),
        )
        .toBe(initialHeight);
      await page.locator("#words .word").first().tap();
      await expect(page.locator("#wordsInput")).toBeFocused();
      await page.screenshot({ path: info.outputPath("touch-ready.png") });
    } finally {
      pending.resolve(undefined);
    }
  });
});

for (const target of ["chrome.client", "CookiesModal"]) {
  test(`a delayed ${target} download cannot open consent over an active test`, async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.removeItem("acceptedCookies"));
    const pending = Promise.withResolvers<undefined>();
    let blocked = false;
    const pattern = `**/assets/${target}-*.js`;
    await page.route(pattern, async (route) => {
      blocked = true;
      await pending.promise;
      await route.continue();
    });
    try {
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await expect.poll(() => blocked).toBe(true);
      const words = await page.locator("#words .word").allTextContents();
      const text = words.join(" ");
      await page.locator("#words .word").first().click();
      await page.keyboard.type(text.slice(0, 1));
      await expect(page.locator("#words letter.correct")).toHaveCount(1);
      const response = page.waitForResponse(pattern);
      pending.resolve(undefined);
      await (await response).finished();
      await expect(page.locator("#solidmodals")).toHaveCount(1);
      if (target === "CookiesModal") {
        await expect(page.locator("#CookiesModal")).toHaveCount(1);
      }
      await expect(page.locator("#CookiesModal")).not.toBeVisible();
      await expect(page.locator("#wordsInput")).toBeFocused();
      await page.keyboard.type(text.slice(1), { delay: 10 });
      await expect(page.locator("#result")).toBeVisible();
      await expect(page.locator("#CookiesModal")).toBeVisible();
    } finally {
      pending.resolve(undefined);
    }
  });
}
