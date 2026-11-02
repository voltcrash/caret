import { getDefaultConfig } from "@caret/web-shared/config/default-config";
import {
  initialTypingCookie,
  previewSettings,
} from "../src/features/typing/initial-snapshot";
import { expect, test } from "../e2e/fixtures";

test.use({ config: {}, serviceWorkers: "block" });

test("first visit keeps its first painted words when the engine becomes ready", async ({
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
    const initialBox = await page
      .locator("[data-initial-words] .word")
      .first()
      .boundingBox();
    await page.screenshot({
      path: info.outputPath("first-paint-before-wasm.png"),
    });
    pending.resolve(undefined);
    await expect(page.locator("#words .word").first()).toBeVisible();
    const actualBox = await page.locator("#words .word").first().boundingBox();
    expect(actualBox?.y).toBeCloseTo(initialBox?.y ?? 0, 0);
    expect(actualBox?.height).toBeCloseTo(initialBox?.height ?? 0, 0);
    const actual = await page.locator("#words .word").allTextContents();
    expect(actual.length).toBeGreaterThan(20);
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
    viewport: { width: 1600, height: 1000 },
    config: {
      mode: "words",
      words: 25,
      fontSize: 3,
      punctuation: true,
      maxLineWidth: 40,
      keymapMode: "react",
      keymapLegendStyle: "blank",
      keymapKeys: "minimal",
      keymapSize: 1,
    },
  });
  test("reload paints a different paragraph and keeps it when JavaScript starts", async ({
    page,
  }, info) => {
    await page.goto("/");
    await expect(page.locator("#words .word").first()).toBeVisible();
    const words = await page.locator("#words .word").allTextContents();
    await expect(page.locator('[data-ui-element="keymap"]')).toBeVisible();
    await expect
      .poll(async () =>
        (await page.context().cookies()).some(
          (cookie) => cookie.name === "caret_typing_preview",
        ),
      )
      .toBe(true);
    const previewCookie = (await page.context().cookies()).find(
      (cookie) => cookie.name === initialTypingCookie,
    );
    const next = JSON.parse(
      decodeURIComponent(previewCookie?.value ?? "{}"),
    ) as {
      words: string[];
    };
    const nextWords = next.words.map((word) =>
      word.endsWith(" ") ? word.slice(0, -1) : word,
    );
    expect(next).toMatchObject({
      settings: { keymapMode: "react", maxLineWidth: 40 },
    });
    expect(nextWords).not.toEqual(words);
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
        nextWords,
      );
      await expect(
        page.locator('[data-ui-element="initialTestConfig"]'),
      ).toBeVisible();
      await expect(page.getByText("Preparing typing test…")).toHaveCount(0);
      await expect(page.locator("[data-initial-keymap]")).toBeVisible();
      const beforeWords = await page
        .locator("[data-initial-words] .word")
        .first()
        .boundingBox();
      const beforeKeyboard = await page
        .locator("[data-initial-keymap]")
        .boundingBox();
      await page.screenshot({
        path: info.outputPath("returning-before-js.png"),
      });
      pending.resolve(undefined);
      await expect(page.locator("#words .word").first()).toBeVisible();
      await expect(page.locator("#words .word")).toHaveCount(words.length);
      await expect(page.locator("#words .word")).toHaveText(nextWords);
      const afterWords = await page
        .locator("#words .word")
        .first()
        .boundingBox();
      for (const key of ["x", "y", "height"] as const) {
        expect(afterWords?.[key]).toBeCloseTo(beforeWords?.[key] ?? 0, 0);
      }
      const afterKeyboard = await page
        .locator('[data-ui-element="keymap"]')
        .boundingBox();
      for (const key of ["x", "y", "width", "height"] as const) {
        expect(afterKeyboard?.[key]).toBeCloseTo(beforeKeyboard?.[key] ?? 0, 0);
      }
      await page.screenshot({ path: info.outputPath("returning-ready.png") });
    } finally {
      pending.resolve(undefined);
    }
  });
});

test("client navigation rejects a preview from an obsolete engine build", async ({
  page,
}) => {
  const pending = Promise.withResolvers<undefined>();
  let blocked = false;
  let documents = 0;
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documents++;
    }
  });
  await page.route("**/assets/*.wasm", async (route) => {
    blocked = true;
    await pending.promise;
    await route.continue();
  });
  try {
    await page.goto("/profile/fixture-profile", {
      waitUntil: "domcontentloaded",
    });
    await expect.poll(() => blocked).toBe(true);
    await expect(page.locator('[data-ui-element="logoText"]')).toBeVisible();
    const value = encodeURIComponent(
      JSON.stringify({
        version: 1,
        seed: 1,
        key: "a".repeat(64),
        engineHash: "0".repeat(64),
        words: ["obsolete-preview"],
        settings: previewSettings(getDefaultConfig()),
      }),
    );
    await page.evaluate(
      ({ name, value }) => {
        document.cookie = `${name}=${value}; Path=/; SameSite=Lax`;
      },
      { name: initialTypingCookie, value },
    );
    await page.getByRole("link", { name: "Caret Home", exact: true }).click();
    await expect(
      page.locator("[data-initial-words] .word").first(),
    ).toBeVisible();
    await expect(
      page.getByText("obsolete-preview", { exact: true }),
    ).toHaveCount(0);
    expect(documents).toBe(1);
    pending.resolve(undefined);
    await expect(page.locator("#words .word").first()).toBeVisible();
  } finally {
    pending.resolve(undefined);
  }
});
