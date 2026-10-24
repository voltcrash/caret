import { describe, it, expect } from "vite-plus/test";
import { Formatting } from "../src/format";
import {
  CustomLimit,
  getCurrentWordCount,
  getLiveAccText,
  getLiveBurstText,
  getLiveSpeedText,
  getTimerText,
  getWordsTotal,
  isTimerFlashHidden,
} from "../src/live-stats";

const wordLimit: CustomLimit = { mode: "word", value: 9 };
const timeLimit: CustomLimit = { mode: "time", value: 60 };
const config = { mode: "time", time: 30, words: 25 } as const;

describe("live stats", () => {
  it("formats speed in the configured unit and blind mode shows raw", () => {
    const wpm = new Formatting({
      typingSpeedUnit: "wpm",
      alwaysShowDecimalPlaces: true,
    });
    const cpm = new Formatting({
      typingSpeedUnit: "cpm",
      alwaysShowDecimalPlaces: false,
    });
    const stats = { wpm: 80.4, raw: 95.6, burst: 101.5 };
    // Live stats never show decimals.
    expect(getLiveSpeedText(wpm, false, stats)).toBe("80");
    expect(getLiveSpeedText(wpm, true, stats)).toBe("96");
    expect(getLiveSpeedText(cpm, false, stats)).toBe("402");
    expect(getLiveBurstText(wpm, stats)).toBe("102");
    expect(getLiveSpeedText(wpm, false, {})).toBe("0");
  });

  it("floors accuracy and hides it in blind mode", () => {
    expect(getLiveAccText(false, { acc: 97.9 })).toBe("97%");
    expect(getLiveAccText(false, {})).toBe("100%");
    expect(getLiveAccText(true, { acc: 50 })).toBe("100%");
  });

  it("counts down time-limited tests", () => {
    const base = {
      customLimit: wordLimit,
      activeWordIndex: 3,
      wordCount: 3,
      wordsTotal: 100,
    };
    expect(getTimerText({ ...base, config, seconds: 5 })).toBe("25");
    expect(getTimerText({ ...base, config, seconds: undefined })).toBe("30");
    expect(
      getTimerText({
        ...base,
        config: { ...config, time: 120 },
        seconds: 0,
      }),
    ).toBe("02:00");
    // Unlimited time counts up.
    expect(
      getTimerText({ ...base, config: { ...config, time: 0 }, seconds: 75 }),
    ).toBe("01:15");
    expect(
      getTimerText({
        ...base,
        config: { ...config, mode: "custom" },
        customLimit: timeLimit,
        seconds: 10,
      }),
    ).toBe("50");
  });

  it("counts words otherwise", () => {
    const words = { ...config, mode: "words" } as const;
    const base = { customLimit: wordLimit, seconds: 4, activeWordIndex: 4 };
    expect(
      getTimerText({ ...base, config: words, wordCount: 4, wordsTotal: 25 }),
    ).toBe("4/25");
    expect(
      getTimerText({
        ...base,
        config: { ...config, mode: "zen" },
        wordCount: 4,
        wordsTotal: 4,
      }),
    ).toBe("4");
  });

  it("derives word totals and section counts", () => {
    const base = { customLimit: wordLimit, quoteLength: 12, wordsLength: 50 };
    expect(
      getWordsTotal({ ...base, config: { ...config, mode: "words" } }),
    ).toBe(25);
    expect(
      getWordsTotal({ ...base, config: { ...config, mode: "custom" } }),
    ).toBe(9);
    expect(
      getWordsTotal({ ...base, config: { ...config, mode: "quote" } }),
    ).toBe(12);
    expect(getWordsTotal({ ...base, config })).toBe(50);
    expect(
      getCurrentWordCount({
        mode: "custom",
        customLimit: { mode: "section", value: 3 },
        activeWordIndex: 7,
        getSectionIndex: () => 2,
      }),
    ).toBe(1);
    expect(
      getCurrentWordCount({
        mode: "words",
        customLimit: wordLimit,
        activeWordIndex: 7,
        getSectionIndex: () => 2,
      }),
    ).toBe(7);
  });

  it("flash timers only show every 15 seconds", () => {
    const flash = { ...config, timerStyle: "flash_mini" } as const;
    expect(isTimerFlashHidden(flash, wordLimit, 0)).toBe(false);
    expect(isTimerFlashHidden(flash, wordLimit, 14)).toBe(true);
    expect(isTimerFlashHidden(flash, wordLimit, 15)).toBe(false);
    expect(
      isTimerFlashHidden({ ...flash, timerStyle: "mini" }, wordLimit, 14),
    ).toBe(false);
    expect(isTimerFlashHidden({ ...flash, mode: "words" }, wordLimit, 14)).toBe(
      false,
    );
  });
});
