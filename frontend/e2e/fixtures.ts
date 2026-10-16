import type { Config } from "@oxytype/schemas/configs";
import type { CustomTheme, UserTag } from "@oxytype/schemas/users";
import { GetUserResponseSchema } from "@oxytype/contracts/users";
import { BASE_CONFIGURATION } from "@oxytype/schemas/default-configuration";
import { expect, Page, test as base } from "playwright/test";

import { authCookie, fixtureClientIp } from "../start-e2e/auth-fixtures";

export const TEST_USER_ID = "e2e-user";

export const test = base.extend<{
  config: Partial<Config>;
  authenticated: boolean;
  customThemes: CustomTheme[];
  tags: UserTag[];
  /** Seeded Start session token; Start reads sessions on the server, not via REST. */
  startSession: string | undefined;
}>({
  config: [
    {
      mode: "words",
      words: 15,
      quickRestart: "off",
      smoothCaret: "off",
      singleListCommandLine: "on",
    },
    { option: true },
  ],
  authenticated: [false, { option: true }],
  customThemes: [[], { option: true }],
  tags: [[], { option: true }],
  startSession: [undefined, { option: true }],
  page: async (
    {
      page,
      context,
      baseURL,
      config,
      authenticated,
      customThemes,
      tags,
      startSession,
    },
    use,
    info,
  ) => {
    if (startSession !== undefined) {
      await context.setExtraHTTPHeaders({
        ...info.project.use.extraHTTPHeaders,
        "cf-connecting-ip": fixtureClientIp(info.testId),
      });
    }
    if (authenticated && startSession !== undefined) {
      const value =
        authCookie(startSession).split(";")[0]?.split("=").slice(1).join("=") ??
        "";
      await context.addCookies([
        { name: "oxytype.session_token", value, url: baseURL ?? "" },
      ]);
    }
    const user = GetUserResponseSchema.parse({
      message: "OK",
      data: {
        uid: TEST_USER_ID,
        name: "e2e",
        email: "e2e@example.test",
        addedAt: 0,
        personalBests: { time: {}, words: {}, quote: {}, zen: {}, custom: {} },
        allTimeLbs: { time: {} },
        inventory: { badges: [] },
        tags,
        xp: 0,
        completedTests: 0,
        startedTests: 0,
        timeTyping: 0,
        inboxUnreadSize: 0,
      },
    });
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname.slice(4);
      if (path === "/auth/get-session") {
        await route.fulfill({
          json: authenticated
            ? {
                session: {
                  id: "e2e-session",
                  token: "e2e-token",
                  userId: TEST_USER_ID,
                  expiresAt: "2099-01-01T00:00:00.000Z",
                  createdAt: "2026-01-01T00:00:00.000Z",
                  updatedAt: "2026-01-01T00:00:00.000Z",
                },
                user: {
                  id: TEST_USER_ID,
                  name: "e2e",
                  email: "e2e@example.test",
                  emailVerified: true,
                  createdAt: "2026-01-01T00:00:00.000Z",
                  updatedAt: "2026-01-01T00:00:00.000Z",
                },
              }
            : null,
        });
        return;
      }
      if (path === "/auth/list-accounts") {
        await route.fulfill({
          json: [
            {
              id: "e2e-account",
              accountId: TEST_USER_ID,
              providerId: "github",
              userId: TEST_USER_ID,
            },
          ],
        });
        return;
      }
      if (path === "/users") {
        await route.fulfill({ json: user });
        return;
      }
      const data =
        path === "/configuration"
          ? {
              ...BASE_CONFIGURATION,
              dailyLeaderboards: {
                ...BASE_CONFIGURATION.dailyLeaderboards,
                enabled: false,
              },
              leaderboards: {
                ...BASE_CONFIGURATION.leaderboards,
                weeklyXp: {
                  ...BASE_CONFIGURATION.leaderboards.weeklyXp,
                  enabled: false,
                },
              },
            }
          : path === "/configs"
            ? config
            : path === "/users/customThemes"
              ? customThemes
              : path === "/users/inbox"
                ? { inbox: [], maxMail: 100 }
                : ["/presets", "/results", "/psas"].includes(path)
                  ? []
                  : undefined;
      await route.fulfill(
        data === undefined
          ? { status: 404, json: { message: `Unmocked API route: ${path}` } }
          : { json: { message: "OK", data } },
      );
    });
    await page.route("**/quotes/english.json*", async (route) => {
      await route.fulfill({
        json: {
          language: "english",
          groups: [
            [0, 100],
            [101, 300],
            [301, 600],
            [601, 9999],
          ],
          quotes: [
            {
              id: 123,
              text: "One deterministic quote for testing.",
              source: "E2E fixture",
              length: 36,
            },
          ],
        },
      });
    });
    await page.addInitScript((initialConfig) => {
      localStorage.setItem(
        "acceptedCookies",
        JSON.stringify({ security: false, analytics: false, sentry: false }),
      );
      // A reload must retain changes made through the UI.
      if (localStorage.getItem("config") === null) {
        localStorage.setItem("config", JSON.stringify(initialConfig));
      }
    }, config);
    await use(page);
  },
});

export { expect };

export async function openTest(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator("#words")).toBeVisible();
  await expect(page.locator("#words .word").first()).toBeVisible();
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
}

export async function completeWords(page: Page): Promise<void> {
  const words = await page.locator("#words .word").allTextContents();
  await page.locator("#words .word").first().click();
  await expect(page.locator("#wordsInput")).toBeFocused();
  await page.keyboard.type(words.join(" "), { delay: 60 });
  await expect(page.locator("#result")).toBeVisible();
}

export async function openCommandline(page: Page): Promise<void> {
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.locator("#commandLine")).toBeVisible();
  await expect(page.locator("#commandLine input")).toBeFocused();
}

export async function runCommand(
  page: Page,
  id: string,
  search: string,
): Promise<void> {
  const input = page.locator("#commandLine input");
  await input.fill(search);
  const command = page.locator(`#commandLine [data-command-id="${id}"]`);
  await expect(command).toBeVisible();
  await command.click();
}

export async function assertRestarted(page: Page): Promise<void> {
  await expect(page.locator("#words")).toBeVisible();
  await expect(page.locator("#words .word.active")).toHaveCount(1);
  await expect(
    page.locator("#words letter.correct, #words letter.incorrect"),
  ).toHaveCount(0);
  await expect(page.locator("#wordsInput")).toHaveValue(" ");
  await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
}
