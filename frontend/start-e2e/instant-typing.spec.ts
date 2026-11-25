import { expect, test } from "../e2e/fixtures";

test.use({ config: {}, serviceWorkers: "block" });

test("accepts typing immediately while JS and Wasm are pending and hands off cleanly", async ({
  page,
}) => {
  const pending = Promise.withResolvers<undefined>();
  let blockedJs = false;
  let blockedWasm = false;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.route("**/assets/page.client-*.js", async (route) => {
    blockedJs = true;
    await pending.promise;
    await route.continue();
  });
  await page.route("**/assets/*.wasm", async (route) => {
    blockedWasm = true;
    await pending.promise;
    await route.continue();
  });

  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-initial-words] .word").first(),
    ).toBeVisible();
    await expect.poll(() => blockedJs && blockedWasm).toBe(true);

    const previewWords = await page
      .locator("[data-initial-words] .word")
      .allTextContents();
    const firstWord = previewWords[0] ?? "";
    const secondWord = previewWords[1] ?? "";
    expect(firstWord.length).toBeGreaterThan(0);
    expect(secondWord.length).toBeGreaterThan(1);

    const caretBefore = await page
      .locator("[data-initial-caret]")
      .boundingBox();

    // Type first word with a typo + Backspace, advance with space, and start second word
    await page.keyboard.type(firstWord[0] ?? "");
    await page.keyboard.type("!");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(`${firstWord.slice(1)} ${secondWord.slice(0, 2)}`);

    await expect(page.locator("[data-initial-words] .word").nth(0)).toHaveClass(
      /typed/,
    );
    await expect(
      page
        .locator("[data-initial-words] .word")
        .nth(0)
        .locator("letter.correct"),
    ).toHaveCount(firstWord.length);
    await expect(
      page
        .locator("[data-initial-words] .word")
        .nth(1)
        .locator("letter.correct"),
    ).toHaveCount(2);

    await expect
      .poll(
        async () =>
          (await page.locator("[data-initial-caret]").boundingBox())?.x ?? 0,
      )
      .toBeGreaterThan(caretBefore?.x ?? 0);

    // Release JS and Wasm; real engine must take over with all keystrokes preserved.
    pending.resolve(undefined);

    await expect(page.locator("[data-initial-typing]")).toHaveCount(0);
    await expect(page.locator("#words .word").first()).toBeVisible();
    await expect(page.locator("#words .word").nth(0)).toHaveClass(/typed/);
    await expect(
      page.locator("#words .word").nth(0).locator("letter.correct"),
    ).toHaveCount(firstWord.length);
    await expect(
      page.locator("#words .word").nth(1).locator("letter.correct"),
    ).toHaveCount(2);
    await expect(page.locator("#wordsInput")).toBeFocused();

    // Continue typing seamlessly into the live engine.
    await page.keyboard.type(secondWord.slice(2));
    await expect(
      page.locator("#words .word").nth(1).locator("letter.correct"),
    ).toHaveCount(secondWord.length);
    expect(errors).toEqual([]);
  } finally {
    pending.resolve(undefined);
  }
});

test("delayed handoff past 1.5s advances elapsed ticks without slow-timer failure", async ({
  page,
}) => {
  const pending = Promise.withResolvers<undefined>();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.route("**/assets/*.wasm", async (route) => {
    await pending.promise;
    await route.continue();
  });

  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const firstWord =
      (await page
        .locator("[data-initial-words] .word")
        .first()
        .textContent()) ?? "";
    await page.keyboard.type(firstWord.slice(0, 2));
    await expect(
      page.locator("[data-initial-words] letter.correct"),
    ).toHaveCount(2);

    // Wait past the 125ms/500ms render-drift threshold before letting Wasm arrive.
    await page.waitForTimeout(1600);
    pending.resolve(undefined);

    await expect(page.locator("#words .word").first()).toBeVisible();
    await expect(
      page.locator("#words .word").first().locator("letter.correct"),
    ).toHaveCount(2);
    await expect(page.locator("#result")).not.toBeVisible();
    await expect(page.getByText(/bad performance/i)).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    pending.resolve(undefined);
  }
});

test("skips pre-hydration capture when saved config alters typing rules", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "config",
      JSON.stringify({ mode: "time", time: 30, stopOnError: "letter" }),
    );
  });
  const pending = Promise.withResolvers<undefined>();
  await page.route("**/assets/*.wasm", async (route) => {
    await pending.promise;
    await route.continue();
  });

  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-initial-words] .word").first(),
    ).toBeVisible();
    await page.keyboard.type("abc");
    await expect(
      page.locator("[data-initial-words] letter.correct"),
    ).toHaveCount(0);
    pending.resolve(undefined);
    await expect(page.locator("#words .word").first()).toBeVisible();
    await expect(page.locator("#words letter.correct")).toHaveCount(0);
    await expect(page.locator("#words letter.incorrect")).toHaveCount(0);
  } finally {
    pending.resolve(undefined);
  }
});
