import type { Config } from "@oxytype/schemas/configs";
import type { Page } from "playwright/test";

import { assertRestarted, expect, openTest, test } from "./fixtures";

async function expectOrderedLayout(page: Page): Promise<void> {
  const layout = await page.evaluate(() => {
    const rect = (selector: string): { top: number; bottom: number } => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      const bounds = element.getBoundingClientRect();
      return { top: bounds.top, bottom: bounds.bottom };
    };
    return {
      config: rect('[data-ui-element="testConfig"]'),
      typing: rect("#typingTest"),
      footer: rect("footer"),
      width: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  expect(layout.typing.top).toBeGreaterThanOrEqual(layout.config.bottom);
  expect(layout.footer.top).toBeGreaterThanOrEqual(layout.typing.bottom);
  expect(layout.width).toBeLessThanOrEqual(layout.viewportWidth);
}

const sizingCases: { name: string; config: Partial<Config> }[] = [
  { name: "small font", config: { fontSize: 1 } },
  { name: "large font", config: { fontSize: 4 } },
  { name: "narrow lines", config: { maxLineWidth: 20 } },
  { name: "medium lines", config: { maxLineWidth: 60 } },
  { name: "wide lines", config: { maxLineWidth: 1000 } },
  {
    name: "all lines",
    config: { mode: "words", words: 100, showAllLines: true, maxLineWidth: 40 },
  },
  { name: "alternate font", config: { fontFamily: "Fira_Code" } },
  { name: "hidden notices", config: { showTestModesNotice: false } },
  ...(["static", "react", "next"] as const).map((keymapMode) => ({
    name: `${keymapMode} keymap`,
    config: { keymapMode, keymapSize: 2, keymapKeys: "full" as const },
  })),
  ...(["text", "mini"] as const).map((style) => ({
    name: `${style} live stats`,
    config: {
      timerStyle: style,
      liveSpeedStyle: style,
      liveAccStyle: style,
      liveBurstStyle: style,
    },
  })),
  ...(["letter", "word"] as const).flatMap((tapeMode) =>
    [10, 50, 90].map((tapeMargin) => ({
      name: `${tapeMode} tape at ${tapeMargin}%`,
      config: { tapeMode, tapeMargin },
    })),
  ),
];

for (const { name, config } of sizingCases) {
  test.describe(name, () => {
    test.use({
      viewport: { width: 1536, height: 925 },
      config: { mode: "time", time: 30, smoothCaret: "off", ...config },
    });

    test("resizes words, accepts input and restarts without overlap", async ({
      page,
    }) => {
      await openTest(page);
      await expectOrderedLayout(page);
      if (config.fontSize !== undefined) {
        await expect(page.locator("#words")).toHaveCSS(
          "font-size",
          `${config.fontSize * 16}px`,
        );
      }
      if (config.maxLineWidth !== undefined) {
        const width = await page.locator("#typingTest").evaluate((element) => {
          return {
            actual: element.getBoundingClientRect().width,
            max: parseFloat(getComputedStyle(element).maxWidth),
          };
        });
        expect(width.actual).toBeLessThanOrEqual(width.max + 1);
      }
      if (config.tapeMode !== undefined) {
        await expect(page.locator("#wordsWrapper")).toHaveClass(/\btape\b/);
      }
      if (config.keymapMode !== undefined) {
        const keymap = page.locator('[data-ui-element="keymap"]');
        await expect(keymap).toBeVisible();
        const keyboard = await keymap.boundingBox();
        const words = await page.locator("#wordsWrapper").boundingBox();
        if (!keyboard || !words) {
          throw new Error("Keymap has no layout");
        }
        expect(keyboard.y).toBeGreaterThanOrEqual(words.y + words.height);
      }
      if (config.showAllLines) {
        const first = await page.locator("#words .word").first().boundingBox();
        const last = await page.locator("#words .word").last().boundingBox();
        const wrapper = await page.locator("#wordsWrapper").boundingBox();
        if (!first || !last || !wrapper) {
          throw new Error("Words have no layout");
        }
        expect(last.y + last.height).toBeLessThanOrEqual(
          wrapper.y + wrapper.height,
        );
        expect(last.y - first.y).toBeGreaterThan(first.height * 3);
      }

      const word = page.locator("#words .word").first();
      const text = await word.textContent();
      if (text === null || text === "") throw new Error("First word is empty");
      await word.click();
      await page.keyboard.type(`${text} `, { delay: 60 });
      await expect(page.locator("#words .word.typed")).toHaveCount(1);
      await expect(page.locator("#caret")).toBeVisible();
      if (config.liveAccStyle !== undefined) {
        await expect(page.locator("#typingTest")).toContainText("100%");
      }
      await expectOrderedLayout(page);
      await page.locator("#restartTestButton").click();
      await assertRestarted(page);
      await expectOrderedLayout(page);
    });
  });
}

test("font, line width and tape changes apply through settings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 925 });
  await openTest(page);
  for (const [key, value] of [
    ["fontSize", "3"],
    ["maxLineWidth", "40"],
    ["tapeMode", "letter"],
    ["tapeMargin", "25"],
    ["tapeMode", "off"],
    ["fontSize", "2"],
    ["maxLineWidth", "0"],
  ] as const) {
    await page.goto(`/settings?highlight=${key}`);
    const setting = page.locator(`[data-setting-key="${key}"]`);
    if (key === "tapeMode") {
      await setting.getByRole("button", { name: value, exact: true }).click();
    } else {
      const input = setting.getByRole("spinbutton");
      await input.fill(value);
      await input.press("Enter");
    }
    await page.getByRole("link", { name: "Oxytype Home", exact: true }).click();
    await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
    await expectOrderedLayout(page);
    await expect
      .poll(
        async () =>
          await page.evaluate((configKey) => {
            const config = JSON.parse(
              localStorage.getItem("config") ?? "{}",
            ) as Partial<Config>;
            return String(config[configKey]);
          }, key),
      )
      .toBe(value);
  }
});

test.describe("numeric textbox controls", () => {
  test.use({ config: { fontSize: 2, maxLineWidth: 60, keymapMode: "static" } });

  for (const [settingKey, configKey, value] of [
    ["fontSize", "fontSize", 3],
    ["maxLineWidth", "maxLineWidth", 40],
    ["paceCaret", "paceCaretCustomSpeed", 120],
  ] as const) {
    test(`${configKey} saves on blur and Enter without freezing`, async ({
      page,
    }) => {
      await openTest(page);
      await page.goto(`/settings?highlight=${settingKey}`);
      const input = page
        .locator(`[data-setting-key="${settingKey}"]`)
        .getByRole("spinbutton");
      for (const key of ["Tab", "Enter"]) {
        const nextValue = key === "Tab" ? value : value + 1;
        await input.fill(String(nextValue));
        await input.press(key);
        await expect
          .poll(
            async () =>
              await page.evaluate((name) => {
                const config = JSON.parse(
                  localStorage.getItem("config") ?? "{}",
                ) as Partial<Config>;
                return config[name];
              }, configKey),
          )
          .toBe(nextValue);
      }
      await page
        .getByRole("link", { name: "Oxytype Home", exact: true })
        .click();
      await expect(page.locator("#words .word").first()).toBeVisible();
    });
  }

  test("keymap size slider resizes the keyboard", async ({ page }) => {
    await openTest(page);
    const before = await page
      .locator('[data-ui-element="keymap"]')
      .boundingBox();
    if (!before) throw new Error("Keymap has no layout");
    await page.goto("/settings?highlight=keymapSize");
    const slider = page.getByRole("slider", {
      name: "Keymap size",
      exact: true,
    });
    await slider.focus();
    await slider.press("ArrowRight");
    await expect(slider).toHaveValue("1.1");
    await page.getByRole("link", { name: "Oxytype Home", exact: true }).click();
    await expect(page.locator("#typingTest")).toHaveCSS("opacity", "1");
    const after = await page
      .locator('[data-ui-element="keymap"]')
      .boundingBox();
    if (!after) throw new Error("Keymap has no layout");
    expect(after.height).toBeGreaterThan(before.height);
  });

  for (const [key, invalid, valid] of [
    ["fontSize", 0, 3],
    ["maxLineWidth", 19, 40],
  ] as const) {
    test(`${key} rejects invalid sizes and recovers`, async ({
      page,
      config,
    }) => {
      await openTest(page);
      await page.goto(`/settings?highlight=${key}`);
      const input = page
        .locator(`[data-setting-key="${key}"]`)
        .getByRole("spinbutton");
      await input.fill(String(invalid));
      await input.press("Enter");
      const saved = await page.evaluate((name) => {
        const value = JSON.parse(
          localStorage.getItem("config") ?? "{}",
        ) as Partial<Config>;
        return value[name];
      }, key);
      expect(saved).toBe(config[key]);
      await input.fill(String(valid));
      await input.press("Tab");
      await page
        .getByRole("link", { name: "Oxytype Home", exact: true })
        .click();
      await expect(page.locator("#words .word").first()).toBeVisible();
    });
  }
});
