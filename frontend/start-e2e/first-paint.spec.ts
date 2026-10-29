import { expect, test } from "../e2e/fixtures";

test.use({ config: {}, serviceWorkers: "block" });

test("first visit paints actual words and controls before engine downloads", async ({
  page,
}, info) => {
  const pending = Promise.withResolvers<undefined>();
  let blocked = false;
  await page.route("**/assets/*.wasm", async (route) => {
    blocked = true;
    await pending.promise;
    await route.continue();
  });
  try {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect.poll(() => blocked).toBe(true);
    const html = await response?.text();
    expect(html).toContain("data-initial-words");
    expect(html).not.toContain("Preparing typing test");
    const initial = await page
      .locator("[data-initial-words] .word")
      .allTextContents();
    expect(initial.length).toBeGreaterThan(20);
    await expect(
      page.locator('[data-ui-element="initialTestConfig"]'),
    ).toBeVisible();
    await expect(
      page.locator("[data-initial-words] .word").first(),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath("first-paint-before-wasm.png"),
    });
    pending.resolve(undefined);
    await expect(page.locator("#words .word").first()).toBeVisible();
    const actual = await page.locator("#words .word").allTextContents();
    expect(actual.slice(0, initial.length)).toEqual(initial);
    const first = actual[0]?.[0];
    if (first === undefined) throw new Error("Missing word");
    await page.locator("#words .word").first().click();
    await page.keyboard.type(first);
    await expect(page.locator("#words letter.correct")).toHaveCount(1);
    await page.screenshot({ path: info.outputPath("first-paint-ready.png") });
  } finally {
    pending.resolve(undefined);
  }
});

test.describe("returning visit", () => {
  test.use({
    config: { mode: "words", words: 25, fontSize: 3, punctuation: true },
  });
  test("renders saved words and settings with all JavaScript blocked", async ({
    page,
  }, info) => {
    await page.goto("/");
    await expect(page.locator("#words .word").first()).toBeVisible();
    const words = await page.locator("#words .word").allTextContents();
    await expect
      .poll(async () =>
        (await page.context().cookies()).some(
          (cookie) => cookie.name === "caret_typing_preview",
        ),
      )
      .toBe(true);
    const pending = Promise.withResolvers<undefined>();
    await page.route("**/assets/*.js", async (route) => {
      await pending.promise;
      await route.continue();
    });
    try {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(
        page.locator("[data-initial-words] .word").first(),
      ).toBeVisible();
      await expect(page.locator("[data-initial-words] .word")).toHaveText(
        words,
      );
      await expect(
        page.locator('[data-ui-element="initialTestConfig"]'),
      ).toBeVisible();
      await expect(page.getByText("Preparing typing test…")).toHaveCount(0);
      await page.screenshot({
        path: info.outputPath("returning-before-js.png"),
      });
      pending.resolve(undefined);
      await expect(page.locator("#words .word").first()).toBeVisible();
      await expect(page.locator("#words .word")).toHaveText(words);
      await page.screenshot({ path: info.outputPath("returning-ready.png") });
    } finally {
      pending.resolve(undefined);
    }
  });
});
