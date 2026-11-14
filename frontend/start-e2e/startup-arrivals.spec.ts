import type { Page } from "playwright/test";

import { expect, test } from "../e2e/fixtures";
import { fulfillOperation, rpcPath } from "./rpc-fixtures";

test.use({
  authenticated: true,
  startSession: "browser-typing",
  serviceWorkers: "block",
  config: { mode: "time", time: 30, showAverage: "both", showPb: true },
  tags: [
    {
      _id: "arrival_tag",
      name: "long_practice",
      personalBests: { time: {}, words: {}, quote: {}, zen: {}, custom: {} },
    },
  ],
});

function gate(
  page: Page,
  pattern: string,
): {
  install: () => Promise<void>;
  requested: () => boolean;
  release: () => void;
} {
  const pending = Promise.withResolvers<undefined>();
  let requested = false;
  return {
    install: async () => {
      await page.route(pattern, async (route) => {
        requested = true;
        await pending.promise;
        await route.fallback();
      });
    },
    requested: () => requested,
    release: () => pending.resolve(undefined),
  };
}

async function geometry(
  page: Page,
): Promise<{ x: number; y: number; width: number; height: number }[]> {
  return Promise.all(
    [
      page.locator('[data-ui-element="header"]'),
      page.getByRole("link", { name: "Settings", exact: true }),
      page.getByRole("button", { name: "english", exact: true }),
      page.locator("#words .word").first(),
    ].map(async (locator) => {
      const box = await locator.boundingBox();
      if (box === null) throw new Error("Missing startup element");
      return box;
    }),
  );
}

for (const scenario of [
  { name: "desktop", width: 1440, touch: false, reduced: false },
  { name: "phone", width: 390, touch: true, reduced: false },
  { name: "small phone", width: 320, touch: true, reduced: false },
  { name: "reduced motion", width: 390, touch: true, reduced: true },
]) {
  test.describe(scenario.name, () => {
    test.use({
      viewport: { width: scenario.width, height: 900 },
      isMobile: scenario.touch,
      hasTouch: scenario.touch,
      reducedMotion: scenario.reduced ? "reduce" : "no-preference",
    });

    test("late account, stats and announcements leave the page in place", async ({
      page,
    }, info) => {
      const session = gate(page, `**${rpcPath("getSessionState")}*`);
      const account = gate(page, `**${rpcPath("usersGet")}*`);
      const results = gate(page, `**${rpcPath("resultsGet")}*`);
      const average = gate(page, "**/assets/AverageNotice-*.js");
      const tags = gate(page, "**/assets/TagsNotice-*.js");
      const user = gate(page, "**/assets/User-*.js");
      const announcements = gate(page, `**${rpcPath("psasGet")}*`);
      // Exercise a wide identity and real values as well as empty history.
      const populated =
        scenario.name === "desktop" || scenario.name === "phone";
      const pbText = populated ? "120.50 wpm 99% acc" : "no pb";
      const averageText = populated ? "100 wpm 98% acc" : "no average";
      await page.route(`**${rpcPath("usersGet")}*`, async (route) =>
        fulfillOperation(route, {
          uid: "e2e-user",
          name: "long_account_123",
          addedAt: 0,
          xp: 100000,
          verified: true,
          tags: [
            {
              _id: "arrival_tag",
              name: "long_practice",
              personalBests: {
                time: {},
                words: {},
                quote: {},
                zen: {},
                custom: {},
              },
            },
          ],
          personalBests: {
            time: populated
              ? {
                  "30": [
                    {
                      wpm: 120.5,
                      acc: 99,
                      raw: 121,
                      consistency: 99,
                      timestamp: 1,
                      language: "english",
                      difficulty: "normal",
                      lazyMode: false,
                    },
                  ],
                }
              : {},
            words: {},
            quote: {},
            zen: {},
            custom: {},
          },
        }),
      );
      if (populated) {
        await page.route(`**${rpcPath("resultsGet")}*`, async (route) =>
          fulfillOperation(route, [
            {
              _id: "arrival_result",
              uid: "e2e-user",
              wpm: 100,
              acc: 98,
              rawWpm: 101,
              consistency: 99,
              charStats: [250, 0, 0, 0],
              mode: "time",
              mode2: "30",
              testDuration: 30,
              timestamp: 1,
              keyConsistency: 100,
              language: "english",
              tags: ["arrival_tag"],
            },
          ]),
        );
      }
      await page.route(`**${rpcPath("psasGet")}*`, async (route) =>
        fulfillOperation(route, [
          {
            _id: "arrival_psa",
            level: 0,
            message:
              "A late announcement with enough text to wrap on a phone, without moving the typing test.",
          },
        ]),
      );
      const gates = [
        session,
        account,
        results,
        average,
        tags,
        user,
        announcements,
      ];
      for (const pending of gates) await pending.install();
      await page.addInitScript(() =>
        localStorage.setItem("activeTags", JSON.stringify(["arrival_tag"])),
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      try {
        await page.goto("/", { waitUntil: "domcontentloaded" });
        await expect(page.locator("#words .word").first()).toBeVisible();
        await expect.poll(session.requested).toBe(true);
        await page.evaluate(async () => {
          await document.fonts.ready;
        });
        const before = await geometry(page);
        const unchanged = async (): Promise<void> => {
          const after = await geometry(page);
          for (const [index, box] of after.entries()) {
            for (const key of ["x", "y", "width", "height"] as const) {
              expect(box[key], `element ${index}: ${key}`).toBeCloseTo(
                before[index]?.[key] ?? 0,
                0,
              );
            }
          }
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
        };
        await page.screenshot({ path: info.outputPath("before-arrivals.png") });
        session.release();
        await expect.poll(account.requested).toBe(true);
        await expect.poll(average.requested).toBe(true);
        await expect(
          page.getByRole("button", { name: pbText, exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: "no pb", exact: true }),
        ).toHaveCount(0);
        await unchanged();

        account.release();
        await expect.poll(user.requested).toBe(true);
        await expect(
          page.getByRole("button", { name: pbText, exact: true }),
        ).toBeVisible();
        await unchanged();
        user.release();
        await expect(
          page.locator('[data-ui-element="userLevel"]'),
        ).toBeVisible();
        await unchanged();
        const pbBox = await page
          .getByRole("button", { name: pbText, exact: true })
          .boundingBox();

        tags.release();
        average.release();
        await expect(
          page.getByRole("button", { name: "long practice", exact: true }),
        ).toBeVisible();
        await expect.poll(results.requested).toBe(true);
        await expect(
          page.getByRole("button", { name: "no average", exact: true }),
        ).toHaveCount(0);
        await unchanged();
        results.release();
        const summary = page.getByRole("button", {
          name: averageText,
          exact: true,
        });
        await expect(summary).toBeVisible();
        await expect(summary).toHaveCSS(
          "animation-name",
          scenario.reduced ? "none" : "content-in",
        );
        expect(
          await page
            .getByRole("button", { name: pbText, exact: true })
            .boundingBox(),
        ).toEqual(pbBox);
        await unchanged();

        announcements.release();
        const banner = page.getByText("A late announcement", { exact: false });
        await expect(banner).toBeVisible();
        await unchanged();
        await page.screenshot({ path: info.outputPath("after-arrivals.png") });
        await page.getByRole("button", { name: "Dismiss banner" }).click();
        await expect(banner).toHaveCount(0);
        await unchanged();
        const word = page.locator("#words .word").first();
        const first = (await word.textContent())?.[0];
        if (first === undefined) throw new Error("Missing word");
        await word.click();
        await page.keyboard.type(first);
        await expect(word.locator("letter.correct")).toHaveCount(1);
        expect(errors).toEqual([]);
      } finally {
        for (const pending of gates) pending.release();
      }
    });
  });
}
