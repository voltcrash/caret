import { fulfillOperation, rpcPath } from "./rpc-fixtures";
import type { BrowserContext, Locator, Page } from "playwright/test";

import lz from "lz-ts";

import { authCookie } from "./auth-fixtures";
import { expect, test } from "./fixtures";

async function signIn(context: BrowserContext): Promise<void> {
  const value =
    authCookie("browser-typing").split(";")[0]?.split("=").slice(1).join("=") ??
    "";
  await context.addCookies([
    { name: "oxytype.session_token", value, url: "http://127.0.0.1:4185" },
  ]);
}

async function useConfig(page: Page, config: object): Promise<void> {
  await page.addInitScript((initial) => {
    if (localStorage.getItem("config") === null) {
      localStorage.setItem(
        "config",
        JSON.stringify({ quickRestart: "off", smoothCaret: "off", ...initial }),
      );
    }
  }, config);
}

/** Signed-in tests: the account's server preferences match the local ones. */
async function useAccountConfig(page: Page, config: object): Promise<void> {
  await useConfig(page, config);
  await page.route(`**${rpcPath("configsGet")}*`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await fulfillOperation(route, {
      quickRestart: "off",
      smoothCaret: "off",
      ...config,
    });
  });
}

async function openTest(page: Page, url = "/"): Promise<void> {
  await page.goto(url);
  await expect(page.locator("#words .word").first()).toBeVisible();
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
}

async function typeFirstLetters(page: Page, count: number): Promise<number> {
  const word = page.locator("#words .word").first();
  await word.click();
  const input = (await word.textContent())?.slice(0, count) ?? "";
  expect(input.length).toBeGreaterThan(0);
  await page.keyboard.type(input);
  await expect(
    page.locator("#words letter.correct, #words letter.incorrect"),
  ).toHaveCount(input.length);
  return input.length;
}

const nav = (page: Page, name: string): Locator =>
  page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name, exact: true });

function trackDocuments(page: Page): string[] {
  const documents: string[] = [];
  page.on("request", (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      documents.push(request.url());
    }
  });
  return documents;
}

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("deep-linked test settings and theme apply once after startup", async ({
  page,
}) => {
  await useConfig(page, { mode: "words", words: 15 });
  const settings = lz.compressToURI(
    JSON.stringify(["time", "30", null, true, null, null, null, null]),
  );
  const theme = Buffer.from(
    JSON.stringify({ c: Array.from({ length: 10 }, () => "#123456") }),
  ).toString("base64");
  await openTest(page, `/?testSettings=${settings}&customTheme=${theme}`);
  await expect(page.getByText("Settings applied from URL:")).toBeVisible();
  await expect(page.getByText("Custom theme applied")).toBeVisible();
  type Applied = {
    mode: string;
    time: number;
    punctuation: boolean;
    customTheme: boolean;
  };
  const config = async (): Promise<Applied> =>
    page.evaluate(() => {
      const { mode, time, punctuation, customTheme } = (
        window as unknown as { config: Applied }
      ).config;
      return { mode, time, punctuation, customTheme };
    });
  await expect.poll(config).toEqual({
    mode: "time",
    time: 30,
    punctuation: true,
    customTheme: true,
  });
  // A later session refresh must not reapply the URL over a user choice.
  await page.getByRole("button", { name: "60", exact: true }).click();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await page.waitForLoadState("networkidle");
  expect((await config()).time).toBe(60);
});

test("leaving mid-test disposes the route and returning starts a fresh test", async ({
  page,
}) => {
  await useConfig(page, { mode: "time", time: 15 });
  const documents = trackDocuments(page);
  const errors = trackErrors(page);
  await page.clock.install();
  await openTest(page);
  await typeFirstLetters(page, 2);
  await nav(page, "About").click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator("#wordsInput")).toHaveCount(0);
  // The abandoned 15 second timer must not finish or touch detached refs.
  await page.clock.runFor(20_000);
  await page.keyboard.type("abc");
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#words .word.active")).toHaveCount(1);
  await expect(
    page.locator("#words letter.correct, #words letter.incorrect"),
  ).toHaveCount(0);
  await expect(page.locator("#result")).toBeHidden();
  await expect(page.locator("#wordsInput")).toHaveValue(" ");
  expect(documents).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("no_quit blocks leaving an active test until it ends", async ({
  page,
}) => {
  await useConfig(page, { mode: "words", words: 15, funbox: ["no_quit"] });
  await openTest(page);
  await typeFirstLetters(page, 1);
  await nav(page, "About").click();
  await expect(
    page.getByText("No quit funbox is active. Please finish the test."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.locator("#words letter.correct, #words letter.incorrect"),
  ).toHaveCount(1);
});

test("typing keys focus the input and funbox styles leave with the route", async ({
  page,
}) => {
  await useConfig(page, { mode: "words", words: 15, funbox: ["mirror"] });
  await openTest(page);
  const stylesheet = page.locator('link.funBoxTheme[href*="mirror"]');
  await expect(stylesheet).toHaveCount(1);
  await page.locator("#wordsInput").evaluate((input) => input.blur());
  await expect(page.locator("#wordsInput")).not.toBeFocused();
  await page.keyboard.press("a");
  await expect(page.locator("#wordsInput")).toBeFocused();
  await nav(page, "About").click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(stylesheet).toHaveCount(0);
});

test("an in-flight save neither blocks navigation nor submits twice", async ({
  page,
  context,
}) => {
  await signIn(context);
  await useAccountConfig(page, { mode: "words", words: 10 });
  const errors = trackErrors(page);
  const submissions: string[] = [];
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route(`**${rpcPath("resultsAdd")}*`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    submissions.push(route.request().url());
    await released;
    await fulfillOperation(
      route,
      {
        insertedId: "saved_start_result",
        isPb: false,
        tagPbs: [],
        xp: 10,
        dailyXpBonus: false,
        xpBreakdown: { base: 10 },
        streak: 1,
      },
      "Result saved",
    );
  });
  await openTest(page);
  await expect(nav(page, "Sign in")).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  const words = await page.locator("#words .word").allTextContents();
  await page.locator("#words .word").first().click();
  await page.keyboard.type(words.join(" "), { delay: 40 });
  await expect(page.locator("#result")).toBeVisible();
  await expect.poll(() => submissions.length).toBe(1);
  // Calculation and the result fade block navigation; the pending save does not.
  await expect(page.locator("#result")).toHaveCSS("opacity", "1");
  await nav(page, "About").click();
  await expect(page).toHaveURL(/\/about$/);
  release();
  await page.waitForLoadState("networkidle");
  await nav(page, "Test").click();
  await expect(page.locator("#words .word.active")).toHaveCount(1);
  await expect(page.locator("#result")).toBeHidden();
  expect(submissions).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("losing the session mid-test keeps the active attempt", async ({
  page,
  context,
}) => {
  await signIn(context);
  await useAccountConfig(page, { mode: "custom" });
  // Supported custom text makes the short first word deterministic, without
  // replacing integrity-checked language assets.
  await page.addInitScript(() => {
    localStorage.setItem(
      "customTextSettings",
      JSON.stringify({
        text: ["to", "be", "or", "not", "to", "be"],
        mode: "repeat",
        limit: { mode: "word", value: 6 },
        pipeDelimiter: false,
      }),
    );
  });
  await openTest(page);
  await expect(nav(page, "Sign in")).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  const typed = await typeFirstLetters(page, 3);
  expect(typed).toBe(2);
  await context.clearCookies();
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(nav(page, "Sign in")).toBeVisible();
  await expect(
    page.locator("#words letter.correct, #words letter.incorrect"),
  ).toHaveCount(typed);
  await expect(page.locator("#wordsInput")).toBeFocused();
});

test("a terminal handoff waits for sign-in and opens its form once", async ({
  page,
  context,
}) => {
  const documents = trackDocuments(page);
  // quote-submit only renders inside quote search (pre-existing in both hosts).
  await page.goto("/?terminalAction=quote-report&language=english&quoteId=1");
  await expect(
    page.getByText("Sign in to continue the terminal browser action").first(),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await signIn(context);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(nav(page, "Sign in")).toHaveCount(0);
  await nav(page, "Test").click();
  const dialog = page.getByRole("dialog", { name: "Report a quote" });
  await expect(dialog).toBeVisible();
  // Escape is ignored until the opening animation finishes.
  await expect(async () => {
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: 500 });
  }).toPass();
  await nav(page, "About").click();
  await nav(page, "Test").click();
  await expect(page.locator("#words .word").first()).toBeVisible();
  await expect(dialog).toBeHidden();
  expect(documents).toHaveLength(1);
});

test("result screenshots download from the native route", async ({ page }) => {
  await useConfig(page, { mode: "words", words: 10 });
  const errors = trackErrors(page);
  await openTest(page);
  const words = await page.locator("#words .word").allTextContents();
  await page.locator("#words .word").first().click();
  await page.keyboard.type(words.join(" "), { delay: 40 });
  await expect(page.locator("#result")).toHaveCSS("opacity", "1");
  const download = page.waitForEvent("download");
  await page.locator("#saveScreenshotButton").click({ modifiers: ["Shift"] });
  expect((await download).suggestedFilename()).toMatch(/\.png$/);
  await expect(page.locator("#result")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a case-insensitive challenge link loads its test settings", async ({
  page,
}) => {
  await useConfig(page, { mode: "words", words: 15 });
  await openTest(page, "/?challenge=ONEHOURWARRIOR");
  await expect(page.getByText(/Challenge .*loaded/).first()).toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(
        () => (window as unknown as { config: { mode: string } }).config.mode,
      ),
    )
    .not.toBe("words");
});
