import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { expect, openTest, test } from "./fixtures";

type TraceEvent = {
  name: string;
  cat: string;
  ph: string;
  ts: number;
  dur?: number;
  args?: {
    data?: {
      compositeFailed?: number;
      unsupportedProperties?: string[];
      nodeName?: string;
      displayName?: string;
    };
  };
};

// Low-end hardware: Chrome's "low-end mobile" CPU preset.
const CPU_THROTTLE = Number(process.env["CARET_SMOOTHNESS_CPU_THROTTLE"] ?? 6);
const CHARACTERS = 120;
// 150 wpm: one character every 80 ms.
const KEY_DELAY = 80;

test.use({
  viewport: { width: 1280, height: 800 },
  config: {
    mode: "time",
    time: 60,
    smoothCaret: "medium",
    smoothLineScroll: true,
    paceCaret: "off",
    quickRestart: "off",
  },
});

/**
 * Types at 150 wpm on a throttled CPU and reports how much the caret costs
 * the main thread, and whether its animations run on the compositor.
 */
test("caret stays on the compositor while typing on a slow CPU", async ({
  page,
}) => {
  await openTest(page);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const text = (await page.locator("#words .word").allTextContents())
    .join(" ")
    .slice(0, CHARACTERS);
  await page.locator("#wordsWrapper").click();
  await expect(page.locator("#wordsInput")).toBeFocused();

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_THROTTLE });
  await page.evaluate(() => {
    const state = window as unknown as {
      __caretFrames: number[];
      __caretLongFrames: number[];
    };
    state.__caretFrames = [];
    state.__caretLongFrames = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        state.__caretLongFrames.push(entry.duration);
      }
    }).observe({ type: "long-animation-frame", buffered: false });
    let last = performance.now();
    const tick = (now: number): void => {
      state.__caretFrames.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const browser = page.context().browser();
  if (browser === null || browser.browserType() !== chromium) {
    throw new Error("Caret tracing needs Chromium");
  }
  await browser.startTracing(page, {
    categories: ["blink.animations", "devtools.timeline"],
  });
  await page.keyboard.type(text, { delay: KEY_DELAY });
  // Let the last move and line scroll settle.
  await page.waitForTimeout(500);
  const trace = await browser.stopTracing();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });

  const { frames, longFrames } = await page.evaluate(() => {
    const state = window as unknown as {
      __caretFrames: number[];
      __caretLongFrames: number[];
    };
    return { frames: state.__caretFrames, longFrames: state.__caretLongFrames };
  });

  const events = (JSON.parse(trace.toString()) as { traceEvents: TraceEvent[] })
    .traceEvents;
  const animations = events.filter(
    (event) => event.name === "Animation" && event.ph === "b",
  );
  const failed = animations.filter(
    (event) => (event.args?.data?.compositeFailed ?? 0) !== 0,
  );
  const unsupported = new Map<string, number>();
  for (const event of failed) {
    for (const property of event.args?.data?.unsupportedProperties ?? []) {
      unsupported.set(property, (unsupported.get(property) ?? 0) + 1);
    }
  }
  const mainThread = (names: string[]): number =>
    events
      .filter((event) => names.includes(event.name) && event.ph === "X")
      .reduce((sum, event) => sum + (event.dur ?? 0), 0) / 1000;
  const sorted = frames.slice(1).sort((a, b) => a - b);
  const percentile = (p: number): number =>
    sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
  const result = {
    cpuThrottle: CPU_THROTTLE,
    characters: text.length,
    frames: sorted.length,
    // Frames the main thread took longer than two vsyncs to produce.
    slowFrames: sorted.filter((frame) => frame > 33.4).length,
    frameP50: percentile(0.5),
    frameP95: percentile(0.95),
    frameP99: percentile(0.99),
    longAnimationFrames: longFrames.length,
    animations: animations.length,
    mainThreadAnimations: failed.length,
    unsupportedProperties: Object.fromEntries(unsupported),
    styleMs: mainThread(["UpdateLayoutTree", "RecalculateStyles"]),
    layoutMs: mainThread(["Layout"]),
    paintMs: mainThread(["Paint", "PrePaint"]),
  };
  const output = process.env["CARET_SMOOTHNESS_BENCHMARK_OUTPUT"];
  if (output !== undefined) {
    await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  }
  console.info(JSON.stringify(result));
});
