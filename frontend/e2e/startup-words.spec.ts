import { writeFile } from "node:fs/promises";

import { fulfillOperation, rpcPath } from "../start-e2e/rpc-fixtures";
import { expect, test } from "./fixtures";

type WordSample = { elapsed: number; words: string[] };

for (const authenticated of [false, true]) {
  test.describe(authenticated ? "signed-in startup" : "guest startup", () => {
    test.use({
      authenticated,
      config: {
        mode: "words",
        words: 15,
        quickRestart: "off",
        smoothCaret: "off",
        theme: "azure",
        showKeyTips: true,
      },
    });

    test("keeps the first painted words through focus, typing and settings sync", async ({
      page,
      config,
    }, info) => {
      const errors: string[] = [];
      let generations = 0;
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.text().includes("Inializing test")) generations++;
      });
      let releaseConfig = (): void => undefined;
      const configReady = new Promise<void>((resolve) => {
        releaseConfig = resolve;
      });
      if (authenticated) {
        await page.route(`**${rpcPath("configsGet")}*`, async (route) => {
          await configReady;
          await fulfillOperation(route, { ...config, showKeyTips: false });
        });
      }
      await page.addInitScript(() => {
        const samples: WordSample[] = [];
        Object.assign(window, { startupWordSamples: samples });
        const intervals = [0, 250, 1000, 3000];
        let started: number | undefined;
        const sample = (now: number): void => {
          const app = document.querySelector("#app");
          const pending = document.querySelector("[data-typing-placeholder]");
          const words = [...document.querySelectorAll("#words .word")].map(
            (word) => word.textContent ?? "",
          );
          if (
            words.length > 0 &&
            app !== null &&
            getComputedStyle(app).opacity !== "0" &&
            pending === null
          ) {
            started ??= now;
            if (now - started >= (intervals[samples.length] ?? Infinity)) {
              samples.push({ elapsed: Math.round(now - started), words });
            }
          }
          if (samples.length < intervals.length) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      const samples = async (): Promise<WordSample[]> =>
        await page.evaluate(
          () =>
            (window as unknown as { startupWordSamples: WordSample[] })
              .startupWordSamples,
        );
      try {
        await page.goto("/");
        await expect
          .poll(async () => (await samples()).length)
          .toBeGreaterThan(0);
        const first = (await samples())[0]?.words ?? [];
        expect(first).toHaveLength(15);
        await expect(page.locator("#startupScreen")).toHaveCount(0);
        await page.evaluate(async () => await document.fonts.ready);
        const mark = await page
          .locator('[data-ui-element="logoText"] svg')
          .boundingBox();
        const theme = await page
          .locator('[data-ui-element="themeIndicator"]')
          .boundingBox();
        const text = await page
          .locator('[data-ui-element="logoText"]')
          .boundingBox();
        expect(mark).not.toBeNull();
        expect(theme).not.toBeNull();
        // The mark leads the word instead of standing in for its "t".
        expect(Math.abs((mark?.x ?? 0) - (text?.x ?? Infinity))).toBeLessThan(
          1,
        );
        expect((mark?.height ?? Infinity) / 32).toBeLessThan(0.75);
        // The theme name tucks under the word without touching it.
        const themeGap =
          (theme?.y ?? 0) - ((mark?.y ?? 0) + (mark?.height ?? 0));
        expect(themeGap).toBeGreaterThan(4);
        expect(themeGap).toBeLessThan(8);
        await page.screenshot({ path: info.outputPath("startup-desktop.png") });
        await page.evaluate(() => {
          window.dispatchEvent(new Event("focus"));
          document.dispatchEvent(new Event("visibilitychange"));
        });
        await expect(page.locator("#words .word")).toHaveText(first);
        await page.keyboard.type(first[0]?.[0] ?? "a");
        releaseConfig();
        await expect(page.locator("#words letter.correct")).toHaveCount(1);
        await expect.poll(async () => (await samples()).length).toBe(4);
        const proof = await samples();
        for (const sample of proof) expect(sample.words).toEqual(first);
        await expect(page.locator("#words letter.correct")).toHaveCount(1);
        expect(generations).toBe(1);
        expect(errors).toEqual([]);
        if (authenticated) {
          expect(
            await page.evaluate(
              () =>
                (
                  JSON.parse(localStorage.getItem("config") ?? "{}") as {
                    showKeyTips?: boolean;
                  }
                ).showKeyTips,
            ),
          ).toBe(true);
          await page.keyboard.type(first.join(" ").slice(1), { delay: 10 });
          await expect(page.locator("#result")).toBeVisible();
          await expect
            .poll(
              async () =>
                await page.evaluate(
                  () =>
                    (
                      JSON.parse(localStorage.getItem("config") ?? "{}") as {
                        showKeyTips?: boolean;
                      }
                    ).showKeyTips,
                ),
            )
            .toBe(false);
        }

        console.log(
          JSON.stringify({
            authenticated,
            generations,
            samples: proof,
            mark,
            theme,
          }),
        );
        const proofPath = info.outputPath("startup-proof.json");
        await writeFile(
          proofPath,
          JSON.stringify(
            { authenticated, generations, samples: proof, mark, theme },
            null,
            2,
          ),
        );
        await info.attach("startup-proof", {
          path: proofPath,
          contentType: "application/json",
        });
      } finally {
        releaseConfig();
      }
    });
  });
}
