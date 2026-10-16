import { describe, it, expect, beforeEach, vi } from "vite-plus/test";

// Baseline for what test/result.ts#update shows on the result screen (stat
// texts, hover labels, test type/other info, crown). Stats are rendered by
// ResultStats.tsx from the result store; the rest is still legacy DOM, recorded
// per selector until it moves to Solid components (P3.x).

const state = vi.hoisted(() => ({
  authenticated: true,
  testInvalid: false,
  localPbWpm: 0,
  accuracy: { correct: 0, incorrect: 0 },
  tags: [] as { _id: string; name: string }[],
  activeTagIds: [] as string[],
  tagPbWpm: 0,
}));

vi.mock("../../src/ts/states/result", async (importOriginal) => {
  const datasets = new Map<string, Record<string, unknown>>();
  const scales = new Map<string, Record<string, unknown>>();
  const chart = {
    data: { labels: [] },
    options: { plugins: { annotation: { annotations: [] } } },
    resize: vi.fn(),
    update: vi.fn(),
  };
  return {
    ...(await importOriginal<object>()),
    getResultChart: () => chart,
    getResultChartDataset: (id: string) => {
      if (!datasets.has(id)) datasets.set(id, { data: [], hidden: false });
      return datasets.get(id);
    },
    getResultChartScale: (id: string) => {
      if (!scales.has(id)) scales.set(id, { title: { text: "" } });
      return scales.get(id);
    },
  };
});
vi.mock("../../src/ts/controllers/quotes-controller", () => ({
  default: { isQuoteFavorite: () => false },
}));
vi.mock("../../src/ts/db", () => ({
  getLocalPB: () =>
    state.localPbWpm === 0 ? undefined : { wpm: state.localPbWpm },
  getSnapshot: () => undefined,
}));
vi.mock("../../src/features/typing/runtime/test-ui", () => ({
  clearWords: vi.fn(),
  clearWordsBlur: vi.fn(),
}));
vi.mock("../../src/features/typing/runtime/today-tracker", () => ({
  getString: () => "",
}));
vi.mock("../../src/features/typing/runtime/focus", () => ({ set: vi.fn() }));
vi.mock("../../src/features/typing/runtime/funbox/funbox", () => ({
  clear: vi.fn(),
}));
vi.mock("../../src/ts/input/input-element", () => ({
  blurInputElement: vi.fn(),
}));
vi.mock("../../src/ts/states/connection", () => ({
  get: () => true,
  showOfflineBanner: vi.fn(),
}));
vi.mock("../../src/ts/states/glarses-mode", () => ({
  get: () => false,
}));
vi.mock("../../src/ts/collections/tags", () => ({
  getLocalTagPB: () => state.tagPbWpm,
  saveLocalTagPB: vi.fn(),
  getActiveTags: () =>
    state.tags.filter((t) => state.activeTagIds.includes(t._id)),
  getTags: () => state.tags,
  getTag: (id: string) => state.tags.find((t) => t._id === id),
}));
vi.mock("../../src/ts/states/core", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isAuthenticated: () => state.authenticated,
}));
vi.mock("../../src/ts/states/test", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getLastEventLog: () => [],
  getCurrentQuote: () => null,
  getResultVisible: () => true,
  getKoreanStatus: () => false,
  isTestInvalid: () => state.testInvalid,
}));
vi.mock("@oxytype/typing-core/events/stats", () => ({
  getAccuracy: () => state.accuracy,
  getRawHistory: () => [],
  getTimerBoundaryLabels: () => [],
  getInputHistory: () => ["hello "],
  getCorrectedWordsHistory: () => [],
  getWordBurstHistory: () => [100],
}));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

import {
  showCrown,
  showErrorCrownIfNeeded,
  toggleResultChartLegend,
  toggleResultWords,
  toggleSmoothedBurst,
  toggleUserFakeChartData,
  update,
  updateTagsAfterEdit,
} from "../../src/features/typing/runtime/result";
import {
  resultState,
  getResultChart,
  getResultChartDataset,
  type ResultStats,
} from "../../src/ts/states/result";
import { __testing } from "../../src/ts/config/testing";
import { getMutableConfig } from "../../src/ts/config/store";
import type { CompletedEvent } from "@oxytype/schemas/results";
import type { Config as ConfigType } from "@oxytype/schemas/configs";
import type { Quote } from "../../src/ts/controllers/quotes-controller";

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
    punctuation: false,
    numbers: false,
    difficulty: "normal",
    lazyMode: false,
    chartData: { wpm: [100, 102], burst: [90, 110], err: [0, 1] },
    ...overrides,
  } as CompletedEvent;
}

type UpdateOptions = {
  difficultyFailed?: boolean;
  failReason?: string;
  afkDetected?: boolean;
  isRepeated?: boolean;
  tooShort?: boolean;
  quote?: Quote | null;
  dontSave?: boolean;
};

async function runUpdate(
  res: CompletedEvent,
  opts: UpdateOptions = {},
): Promise<void> {
  await update(
    res,
    opts.difficultyFailed ?? false,
    opts.failReason ?? "",
    opts.afkDetected ?? false,
    opts.isRepeated ?? false,
    opts.tooShort ?? false,
    opts.quote ?? null,
    opts.dontSave ?? false,
  );
}

const s = (): ResultStats => resultState.stats as ResultStats;

function config(partial: Partial<ConfigType> = {}): void {
  replaceConfig({
    mode: "time",
    time: 30,
    language: "english",
    funbox: [],
    typingSpeedUnit: "wpm",
    alwaysShowDecimalPlaces: false,
    alwaysShowWordsHistory: false,
    ...partial,
  });
}

describe("result update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.authenticated = true;
    state.testInvalid = false;
    state.localPbWpm = 0;
    state.accuracy = { correct: 150, incorrect: 5 };
    state.tags = [];
    state.activeTagIds = [];
    state.tagPbWpm = 0;
    config();
  });

  describe("wpm / raw / acc", () => {
    it("shows rounded values with precise hover labels", async () => {
      await runUpdate(completedEvent());

      expect(s().typingSpeedUnit).toBe("wpm");
      expect(resultState.stats?.wpm).toEqual({
        text: "101",
        ariaLabel: "101.46 wpm",
      });
      expect(s().wpm.text).toBe("101");
      expect(s().wpm.ariaLabel).toBe("101.46 wpm");
      expect(s().raw.text).toBe("111");
      expect(s().raw.ariaLabel).toBe("110.79 wpm");
      expect(s().acc.text).toBe("96%");
      expect(s().acc.ariaLabel).toBe("96.54%\n150 correct\n5 incorrect");
    });

    it("shows 100% accuracy without decimals", async () => {
      await runUpdate(completedEvent({ acc: 100 }));

      expect(s().acc.text).toBe("100%");
      expect(s().acc.ariaLabel).toBe("100%\n150 correct\n5 incorrect");
    });

    it("shows Infinite for wpm >= 1000", async () => {
      await runUpdate(completedEvent({ wpm: 1000 }));

      expect(s().wpm.text).toBe("Infinite");
    });

    it("converts to the configured typing speed unit", async () => {
      config({ typingSpeedUnit: "cpm" });
      await runUpdate(completedEvent());

      expect(s().typingSpeedUnit).toBe("cpm");
      expect(s().wpm.text).toBe("507");
      expect(s().wpm.ariaLabel).toBe("507.28 cpm (101.46 wpm)");
      expect(s().raw.text).toBe("554");
      expect(s().raw.ariaLabel).toBe("553.95 cpm (110.79 wpm)");
    });

    it("uses decimals in text when alwaysShowDecimalPlaces", async () => {
      config({ alwaysShowDecimalPlaces: true });
      await runUpdate(completedEvent());

      expect(s().wpm.text).toBe("101.46");
      expect(s().wpm.ariaLabel).toBeUndefined();
      expect(s().raw.text).toBe("110.79");
      expect(s().acc.text).toBe("96.54%");
      expect(s().acc.ariaLabel).toBe("150 correct\n5 incorrect");
    });
  });

  describe("consistency / time / characters", () => {
    it("shows consistency with key consistency hover", async () => {
      await runUpdate(completedEvent());

      expect(s().consistency.text).toBe("79%");
      expect(s().consistency.ariaLabel).toBe("78.91% (45.67% key)");
    });

    it("shows consistency with decimals when alwaysShowDecimalPlaces", async () => {
      config({ alwaysShowDecimalPlaces: true });
      await runUpdate(completedEvent());

      expect(s().consistency.text).toBe("78.91%");
      expect(s().consistency.ariaLabel).toBe("45.67% key");
    });

    it("shows rounded time, afk percentage and hover", async () => {
      await runUpdate(completedEvent());

      expect(s().time.text).toBe("30s");
      expect(s().time.afk).toBe("9.85% afk");
      expect(s().time.ariaLabel).toBe("30.46s (3s afk 9.85%)");
    });

    it("shows no afk text when there was no afk time", async () => {
      await runUpdate(completedEvent({ afkDuration: 0 }));

      expect(s().time.afk).toBe("");
      expect(s().time.ariaLabel).toBe("30.46s (0s afk 0%)");
    });

    it("formats long tests as duration strings", async () => {
      await runUpdate(completedEvent({ testDuration: 125.4 }));
      expect(s().time.text).toBe("02:05");

      config({ alwaysShowDecimalPlaces: true });
      await runUpdate(completedEvent({ testDuration: 30.456 }));
      expect(s().time.text).toBe("30.46s");
      expect(s().time.ariaLabel).toBe("3s afk 9.85%");
    });

    it("shows char stats", async () => {
      await runUpdate(completedEvent());

      expect(s().characters).toBe("150/5/2/1");
    });
  });

  describe("test type", () => {
    it("shows mode, mode2 and language", async () => {
      await runUpdate(completedEvent());

      expect(s().testType.join("<br>")).toBe("time 30<br>english");
    });

    it("lists enabled modifiers", async () => {
      config({
        mode: "words",
        words: 50,
        punctuation: true,
        numbers: true,
        blindMode: true,
        lazyMode: true,
        difficulty: "master",
        stopOnError: "word",
        deleteOnError: "letter_hard",
      });
      await runUpdate(completedEvent({ language: "english_1k" }));

      expect(s().testType.join("<br>")).toBe(
        "words 50<br>english 1k<br>punctuation<br>numbers<br>blind<br>lazy" +
          "<br>master<br>stop on word<br>delete on letter hard",
      );
    });

    it("shows quote length group", async () => {
      config({ mode: "quote" });
      await runUpdate(completedEvent(), {
        quote: {
          id: 1,
          language: "english",
          group: 2,
          source: "a book",
        } as Quote,
      });

      expect(s().testType.join("<br>")).toBe("quote long<br>english");
    });

    it("omits language in custom mode", async () => {
      config({ mode: "custom" });
      await runUpdate(completedEvent());

      expect(s().testType.join("<br>")).toBe("custom");
    });
  });

  describe("other info", () => {
    it("is hidden when there is nothing to show", async () => {
      await runUpdate(completedEvent());

      expect(s().other).toEqual([]);
    });

    it("lists every flag", async () => {
      state.testInvalid = true;
      await runUpdate(completedEvent({ bailedOut: true, acc: 70 }), {
        difficultyFailed: true,
        failReason: "min wpm",
        afkDetected: true,
        isRepeated: true,
        tooShort: true,
      });

      expect(s().other).not.toEqual([]);
      expect(s().other.join("<br>")).toBe(
        "failed (min wpm)<br>afk detected<br>invalid (accuracy)<br>repeated" +
          "<br>bailed out<br>too short",
      );
    });

    it("names invalid wpm and raw", async () => {
      state.testInvalid = true;
      await runUpdate(completedEvent({ wpm: 400, rawWpm: -1 }));

      expect(s().other.join("<br>")).toBe("invalid (wpm,raw)");
    });
  });

  describe("quote source", () => {
    it("shows source in quote mode", async () => {
      config({ mode: "quote" });
      await runUpdate(completedEvent(), {
        quote: {
          id: 1,
          language: "english",
          group: 0,
          source: "a book",
        } as Quote,
      });

      expect(s().source).toBeDefined();
      expect(s().source).toBe("a book");
    });

    it("is hidden outside quote mode", async () => {
      await runUpdate(completedEvent());

      expect(s().source).toBeUndefined();
    });
  });

  describe("crown", () => {
    const crown = (): typeof resultState.crown => ({ ...resultState.crown });

    it("shows pending crown with diff for a new pb", async () => {
      state.localPbWpm = 90;
      await runUpdate(completedEvent());

      expect(crown()).toEqual({
        visible: true,
        type: "pending",
        text: "+11.46",
        wide: false,
      });
    });

    it("hides crown when not a pb", async () => {
      state.localPbWpm = 120;
      await runUpdate(completedEvent());

      expect(crown()).toMatchObject({ visible: false, text: "", wide: false });
    });

    it("hides crown in quote mode or when not saving", async () => {
      state.localPbWpm = 90;
      config({ mode: "quote" });
      await runUpdate(completedEvent());
      expect(crown().visible).toBe(false);

      config();
      await runUpdate(completedEvent(), { dontSave: true });
      expect(crown().visible).toBe(false);
    });

    it("shows ineligible crown when pb is blocked by config", async () => {
      await runUpdate(completedEvent({ bailedOut: true }));

      expect(crown()).toEqual({
        visible: true,
        type: "ineligible",
        text: "You could've gotten a new PB (+101.46), but your config does not allow it (bailed out)",
        wide: true,
      });
    });

    it("shows warning crown when not eligible and not faster", async () => {
      state.localPbWpm = 120;
      config({ stopOnError: "letter" });
      await runUpdate(completedEvent());

      expect(crown()).toEqual({
        visible: true,
        type: "warning",
        text: "This result is not eligible for a new PB (stop on letter)",
        wide: true,
      });
    });

    it("turns a pending crown into an error crown", async () => {
      state.localPbWpm = 90;
      await runUpdate(completedEvent());
      showErrorCrownIfNeeded();

      expect(crown()).toEqual({
        visible: true,
        type: "error",
        text: "Local PB data is out of sync with the server - please refresh (pb mismatch)",
        wide: true,
      });
    });

    it("confirms a pending crown as normal", async () => {
      state.localPbWpm = 90;
      await runUpdate(completedEvent());
      showCrown("normal");

      expect(crown()).toMatchObject({ visible: true, type: "normal" });
    });

    it("keeps other crowns when the server has no pb", async () => {
      await runUpdate(completedEvent({ bailedOut: true }));
      showErrorCrownIfNeeded();

      expect(crown().type).toBe("ineligible");
    });
  });

  describe("login tip", () => {
    it("is shown only when logged out", async () => {
      await runUpdate(completedEvent());
      expect(resultState.loginTip).toBe(false);

      state.authenticated = false;
      await runUpdate(completedEvent());
      expect(resultState.loginTip).toBe(true);
    });
  });

  describe("tags", () => {
    it("is hidden when the user has no tags", async () => {
      await runUpdate(completedEvent());

      expect(resultState.tags.visible).toBe(false);
      expect(resultState.tags.items).toEqual([]);
    });

    it("lists active tags with pb state", async () => {
      state.tags = [
        { _id: "a", name: "alpha" },
        { _id: "b", name: "beta" },
      ];
      state.activeTagIds = ["a"];
      state.tagPbWpm = 90;
      await runUpdate(completedEvent());

      expect(resultState.tags.visible).toBe(true);
      expect(resultState.tags.items).toEqual([
        { id: "a", name: "alpha", ariaLabel: "+11.46", pb: true },
      ]);
      expect(resultState.tags.savedResultId).toBeUndefined();
    });

    it("keeps existing tags and appends new ones after edit", async () => {
      state.tags = [
        { _id: "a", name: "alpha" },
        { _id: "b", name: "beta" },
        { _id: "c", name: "gamma" },
      ];
      state.activeTagIds = ["a", "b"];
      state.tagPbWpm = 120;
      await runUpdate(completedEvent());

      updateTagsAfterEdit(["b", "c"], ["c"]);

      expect(resultState.tags.items).toEqual([
        { id: "b", name: "beta", ariaLabel: "PB: 120", pb: false },
        { id: "c", name: "gamma", pb: true },
      ]);
    });
  });

  describe("chart legend", () => {
    it("updates chart data when smoothing and fake data are toggled", async () => {
      config();
      await runUpdate(completedEvent());
      toggleSmoothedBurst();
      await vi.waitFor(() =>
        expect(getResultChart().update).toHaveBeenCalledWith("resize"),
      );
      toggleSmoothedBurst();
      toggleUserFakeChartData();
      await vi.waitFor(() =>
        expect(getResultChartDataset("wpm").data).toHaveLength(30),
      );
      expect(getResultChartDataset("error").data).toHaveLength(30);
      toggleUserFakeChartData();
      await vi.waitFor(() =>
        expect(getResultChartDataset("wpm").data).toEqual([100, 102]),
      );
    });
    beforeEach(() => {
      localStorage.removeItem("resultChartDataVisibility");
    });

    it("shows pb button only when logged in", async () => {
      await runUpdate(completedEvent());
      expect(resultState.chartLegend.visibility).toEqual({
        raw: true,
        burst: true,
        errors: true,
        pbLine: true,
        tagPbLine: true,
      });
      expect(resultState.chartLegend.pbLineVisible).toBe(true);

      state.authenticated = false;
      await runUpdate(completedEvent());
      expect(resultState.chartLegend.pbLineVisible).toBe(false);
      expect(resultState.chartLegend.tagPbLineVisible).toBe(false);
    });

    it("toggles data visibility", async () => {
      state.tags = [{ _id: "a", name: "alpha" }];
      state.activeTagIds = ["a"];
      state.tagPbWpm = 120;
      await runUpdate(completedEvent());
      // tag pb lines are added after the legend is updated
      expect(resultState.chartLegend.tagPbLineVisible).toBe(false);

      toggleResultChartLegend("raw");
      expect(resultState.chartLegend.visibility.raw).toBe(false);
      expect(resultState.chartLegend.tagPbLineVisible).toBe(true);

      toggleResultChartLegend("raw");
      expect(resultState.chartLegend.visibility.raw).toBe(true);
    });

    it("toggles start graphs at zero with scale", () => {
      config({ startGraphsAtZero: true });
      toggleResultChartLegend("scale");
      expect(getMutableConfig().startGraphsAtZero).toBe(false);
    });
  });

  describe("words history", () => {
    it("loads words on first show and toggles visibility", async () => {
      await runUpdate(completedEvent());
      expect(resultState.wordsHistory).toMatchObject({
        items: [],
        visible: false,
      });

      toggleResultWords(true);
      expect(resultState.wordsHistory.visible).toBe(true);
      expect(resultState.wordsHistory.slideDuration).toBe(0);
      // input + 2 trailing words
      expect(resultState.wordsHistory.items).toHaveLength(3);
      expect(resultState.wordsHistory.items[0]).toMatchObject({
        input: "hello",
        burst: 100,
        typed: true,
      });

      toggleResultWords();
      expect(resultState.wordsHistory.visible).toBe(false);
      expect(resultState.wordsHistory.slideDuration).toBe(250);
    });

    it("is reset by the next result", async () => {
      await runUpdate(completedEvent());
      toggleResultWords(true);
      await runUpdate(completedEvent());
      expect(resultState.wordsHistory).toMatchObject({
        items: [],
        visible: false,
        slideDuration: 0,
      });
    });

    it("is shown instantly with always show words history", async () => {
      config({ alwaysShowWordsHistory: true });
      await runUpdate(completedEvent());
      expect(resultState.wordsHistory).toMatchObject({
        visible: true,
        slideDuration: 0,
      });
      expect(resultState.wordsHistory.items).toHaveLength(3);
    });
  });
});
