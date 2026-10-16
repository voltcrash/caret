import { describe, it, expect, beforeEach } from "vite-plus/test";
import type { CompletedEvent } from "@oxytype/schemas/results";
import type { Config as ConfigType } from "@oxytype/schemas/configs";
import { __testing } from "../../src/ts/config/testing";
import {
  buildBurstHeatmap,
  getBurstHeatmapWordColor,
  buildCrown,
  buildResultStats,
  buildSpeedStats,
  type ResultStatsOptions,
} from "../../src/features/typing/runtime/result-view-model";

const { replaceConfig } = __testing;

function completedEvent(
  overrides: Partial<CompletedEvent> = {},
): CompletedEvent {
  return {
    wpm: 101.456,
    rawWpm: 110.789,
    acc: 96.543,
    consistency: 78.91,
    keyConsistency: 45.67,
    testDuration: 30.456,
    afkDuration: 3,
    charStats: [150, 5, 2, 1],
    mode: "time",
    mode2: "30",
    language: "english",
    funbox: [],
    bailedOut: false,
    ...overrides,
  } as CompletedEvent;
}

function options(
  overrides: Partial<ResultStatsOptions> = {},
): ResultStatsOptions {
  return {
    accuracy: { correct: 150, incorrect: 5 },
    quote: null,
    testInvalid: false,
    difficultyFailed: false,
    failReason: "",
    afkDetected: false,
    isRepeated: false,
    tooShort: false,
    ...overrides,
  };
}

function config(partial: Partial<ConfigType> = {}): void {
  replaceConfig({
    mode: "time",
    time: 30,
    language: "english",
    funbox: [],
    typingSpeedUnit: "wpm",
    alwaysShowDecimalPlaces: false,
    ...partial,
  });
}

describe("result view model", () => {
  beforeEach(() => {
    config();
  });

  describe("buildSpeedStats", () => {
    it("rounds values and adds precise hover labels", () => {
      expect(
        buildSpeedStats(completedEvent(), { correct: 150, incorrect: 5 }),
      ).toEqual({
        typingSpeedUnit: "wpm",
        wpm: { text: "101", ariaLabel: "101.46 wpm" },
        raw: { text: "111", ariaLabel: "110.79 wpm" },
        acc: {
          text: "96%",
          ariaLabel: "96.54%\n150 correct\n5 incorrect",
          balloonBreak: true,
        },
      });
    });

    it("shows Infinite and 100% accuracy", () => {
      const stats = buildSpeedStats(completedEvent({ wpm: 1000, acc: 100 }), {
        correct: 1,
        incorrect: 0,
      });
      expect(stats.wpm.text).toBe("Infinite");
      expect(stats.acc.text).toBe("100%");
      expect(stats.acc.ariaLabel).toBe("100%\n1 correct\n0 incorrect");
    });

    it("converts to other units with wpm in the hover", () => {
      config({ typingSpeedUnit: "cpm" });
      const stats = buildSpeedStats(completedEvent(), {
        correct: 150,
        incorrect: 5,
      });
      expect(stats.typingSpeedUnit).toBe("cpm");
      expect(stats.wpm).toEqual({
        text: "507",
        ariaLabel: "507.28 cpm (101.46 wpm)",
      });
      expect(stats.raw).toEqual({
        text: "554",
        ariaLabel: "553.95 cpm (110.79 wpm)",
      });
    });

    it("drops speed hovers with decimals in wpm", () => {
      config({ alwaysShowDecimalPlaces: true });
      const stats = buildSpeedStats(completedEvent(), {
        correct: 150,
        incorrect: 5,
      });
      expect(stats.wpm).toEqual({ text: "101.46" });
      expect(stats.raw).toEqual({ text: "110.79" });
      expect(stats.acc).toEqual({
        text: "96.54%",
        ariaLabel: "150 correct\n5 incorrect",
        balloonBreak: false,
      });
    });

    it("keeps wpm hover with decimals in other units", () => {
      config({ alwaysShowDecimalPlaces: true, typingSpeedUnit: "wps" });
      const stats = buildSpeedStats(completedEvent(), {
        correct: 150,
        incorrect: 5,
      });
      expect(stats.wpm.ariaLabel).toBe("101.46 wpm");
      expect(stats.raw.ariaLabel).toBe("110.79 wpm");
    });

    it("has no hovers without an event log", () => {
      const stats = buildSpeedStats(completedEvent(), null);
      expect(stats.wpm.ariaLabel).toBeUndefined();
      expect(stats.raw.ariaLabel).toBeUndefined();
      expect(stats.acc.ariaLabel).toBeUndefined();
    });
  });

  describe("buildResultStats", () => {
    it("builds consistency, time and characters", () => {
      const stats = buildResultStats(completedEvent(), options());
      expect(stats.consistency).toEqual({
        text: "79%",
        ariaLabel: "78.91% (45.67% key)",
      });
      expect(stats.time).toEqual({
        text: "30s",
        afk: "9.85% afk",
        ariaLabel: "30.46s (3s afk 9.85%)",
      });
      expect(stats.characters).toBe("150/5/2/1");
    });

    it("uses decimals when alwaysShowDecimalPlaces", () => {
      config({ alwaysShowDecimalPlaces: true });
      const stats = buildResultStats(completedEvent(), options());
      expect(stats.consistency).toEqual({
        text: "78.91%",
        ariaLabel: "45.67% key",
      });
      expect(stats.time).toEqual({
        text: "30.46s",
        afk: "9.85% afk",
        ariaLabel: "3s afk 9.85%",
      });
    });

    it("formats long tests and no afk", () => {
      const stats = buildResultStats(
        completedEvent({ testDuration: 125.4, afkDuration: 0 }),
        options(),
      );
      expect(stats.time.text).toBe("02:05");
      expect(stats.time.afk).toBe("");
    });

    it("lists test type lines", () => {
      config({
        mode: "words",
        words: 50,
        punctuation: true,
        numbers: true,
        blindMode: true,
        lazyMode: true,
        difficulty: "expert",
        stopOnError: "letter",
        deleteOnError: "word_hard",
      });
      const stats = buildResultStats(
        completedEvent({ language: "english_1k" }),
        options(),
      );
      expect(stats.testType).toEqual([
        "words 50",
        "english 1k",
        "punctuation",
        "numbers",
        "blind",
        "lazy",
        "expert",
        "stop on letter",
        "delete on word hard",
      ]);
    });

    it("shows quote group and source in quote mode", () => {
      config({ mode: "quote" });
      const stats = buildResultStats(
        completedEvent(),
        options({ quote: { group: 3, source: "a book" } }),
      );
      expect(stats.testType).toEqual(["quote thicc", "english"]);
      expect(stats.source).toBe("a book");

      expect(buildResultStats(completedEvent(), options()).source).toBe(
        "Error: Source unknown",
      );
    });

    it("has no source outside quote mode and no language in custom", () => {
      expect(buildResultStats(completedEvent(), options()).source).toBe(
        undefined,
      );
      config({ mode: "custom" });
      expect(buildResultStats(completedEvent(), options()).testType).toEqual([
        "custom",
      ]);
    });

    it("lists other flags", () => {
      expect(buildResultStats(completedEvent(), options()).other).toEqual([]);

      const stats = buildResultStats(
        completedEvent({ bailedOut: true, wpm: 400, rawWpm: -1, acc: 70 }),
        options({
          testInvalid: true,
          difficultyFailed: true,
          failReason: "min acc",
          afkDetected: true,
          isRepeated: true,
          tooShort: true,
        }),
      );
      expect(stats.other).toEqual([
        "failed (min acc)",
        "afk detected",
        "invalid (wpm,raw,accuracy)",
        "repeated",
        "bailed out",
        "too short",
      ]);
    });

    it("allows higher wpm for words 10", () => {
      const stats = buildResultStats(
        completedEvent({ mode: "words", mode2: "10", wpm: 400, rawWpm: 400 }),
        options({ testInvalid: true }),
      );
      expect(stats.other).toEqual(["invalid"]);
    });
  });

  describe("buildCrown", () => {
    it("hides when eligible and not faster", () => {
      expect(buildCrown({ value: true }, 0)).toBeNull();
      expect(buildCrown({ value: true }, -5)).toBeNull();
    });

    it("shows pending with diff for a new pb", () => {
      expect(buildCrown({ value: true }, 11.456)).toEqual({
        type: "pending",
        text: "+11.46",
        wide: false,
      });
    });

    it("warns when not eligible and not faster", () => {
      expect(buildCrown({ value: false, reason: "funbox" }, -1)).toEqual({
        type: "warning",
        text: "This result is not eligible for a new PB (funbox)",
        wide: true,
      });
    });

    it("shows ineligible when not eligible but faster", () => {
      expect(buildCrown({ value: false, reason: "bailed out" }, 2)).toEqual({
        type: "ineligible",
        text: "You could've gotten a new PB (+2.00), but your config does not allow it (bailed out)",
        wide: true,
      });
    });
  });
});

describe("buildBurstHeatmap", () => {
  const theme = {
    bg: "#000000",
    caret: "#ffffff",
    main: "#ff0000",
    sub: "#888888",
    subAlt: "#222222",
    text: "#ffffff",
    error: "#ff0000",
    errorExtra: "#880000",
    colorfulError: "#00ff00",
    colorfulErrorExtra: "#008800",
  };
  const identity = (wpm: number): number => wpm;
  const bursts = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  it("builds legend steps from burst percentiles", () => {
    const heatmap = buildBurstHeatmap(bursts, identity, theme);
    expect(heatmap.steps.map((s) => s.val)).toEqual([0, 20, 40, 70, 90]);
    expect(heatmap.legend).toEqual(["<20", "20-39", "40-69", "70-89", "90+"]);
    expect(heatmap.colors[0]).toBe(theme.colorfulError);
    expect(heatmap.colors[2]).toBe(theme.text);
    expect(heatmap.colors[4]).toBe(theme.main);
    expect(heatmap.unreachedColor).toBe(theme.sub);
  });

  it("uses sub colors when main equals text", () => {
    const heatmap = buildBurstHeatmap(bursts, identity, {
      ...theme,
      main: theme.text,
    });
    expect(heatmap.colors[2]).toBe(theme.sub);
    expect(heatmap.unreachedColor).toBe(theme.subAlt);
  });

  it("does not mutate the burst history", () => {
    const input = [30, 10, 20];
    buildBurstHeatmap(input, identity, theme);
    expect(input).toEqual([30, 10, 20]);
  });

  it("colors words by their burst step", () => {
    const heatmap = buildBurstHeatmap(bursts, identity, theme);
    expect(getBurstHeatmapWordColor(heatmap, 95, identity)).toEqual({
      color: theme.main,
      inherit: true,
    });
    expect(getBurstHeatmapWordColor(heatmap, 5, identity)).toEqual({
      color: theme.colorfulError,
      inherit: true,
    });
    expect(getBurstHeatmapWordColor(heatmap, undefined, identity)).toEqual({
      color: theme.sub,
      inherit: false,
    });
    expect(
      getBurstHeatmapWordColor(heatmap, Infinity, identity),
    ).toBeUndefined();
  });
});
