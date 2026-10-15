import { createRoot } from "solid-js";
import type { LanguageObject } from "@oxytype/schemas/languages";
import type { EventLog } from "@oxytype/typing-core/events/types";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

// Characterizes the web test lifecycle end to end with the real event recorder,
// timer and completion code. Only rendering, storage and transport are mocked.

const mocks = vi.hoisted(() => ({
  active: false,
  restarting: false,
  calculating: false,
  wordIndex: 0,
  generatedWords: ["hello ", "world "],
  liveStats: [] as Record<string, number | undefined>[],
  incomplete: vi.fn(),
  resultUpdate: vi.fn(),
  notice: vi.fn(),
  error: vi.fn(),
  lastEventLog: undefined as EventLog | undefined,
  caretHide: vi.fn(),
  timeWarning: vi.fn(),
  paceStart: vi.fn(),
  paceReset: vi.fn(),
  paceInit: vi.fn(),
  paceLastWpm: vi.fn(),
  todaySeconds: vi.fn(),
  lowFps: vi.fn(),
}));

vi.mock("../../../src/ts/states/test", () => ({
  isTestActive: () => mocks.active,
  setTestActive: (value: boolean) => {
    mocks.active = value;
  },
  isTestRestarting: () => mocks.restarting,
  setIsTestRestarting: (value: boolean) => {
    mocks.restarting = value;
  },
  isResultCalculating: () => mocks.calculating,
  setResultCalculating: (value: boolean) => {
    mocks.calculating = value;
  },
  isRepeated: () => false,
  setIsRepeated: vi.fn(),
  getCurrentQuote: () => null,
  getActiveWordIndex: () => mocks.wordIndex,
  resetActiveWordIndex: vi.fn(),
  getResultVisible: () => false,
  getBailedOut: () => false,
  getKoreanStatus: () => false,
  isPaceRepeat: () => false,
  getIncompleteSeconds: () => 0,
  getIncompleteTests: () => [],
  getRestartCount: () => 0,
  pushIncompleteTest: mocks.incomplete,
  resetIncompleteTests: vi.fn(),
  setKoreanStatus: vi.fn(),
  setLastEventLog: (log: EventLog) => {
    mocks.lastEventLog = log;
  },
  setIsPaceRepeat: vi.fn(),
  setIsTestInvalid: vi.fn(),
  setLastResult: vi.fn(),
  setBailedOut: vi.fn(),
  setLastSignedOutResult: vi.fn(),
  setResultLoading: vi.fn(),
  setResultVisible: vi.fn(),
  setWordsHaveNewline: vi.fn(),
  setWordsHaveNumbers: vi.fn(),
  setWordsHaveTab: vi.fn(),
  setIsDirectionReversed: vi.fn(),
  setIsLanguageRightToLeft: vi.fn(),
  setTestInitError: vi.fn(),
  setCurrentLiveStats: (stats: Record<string, number | undefined>) => {
    mocks.liveStats.push(stats);
  },
}));
vi.mock("../../../src/ts/states/core", () => ({
  getActivePage: () => "test",
  getCustomTextIndicator: () => undefined,
  isAuthenticated: () => false,
}));
vi.mock("../../../src/ts/auth-client", () => ({
  getAuthenticatedUser: () => null,
}));
vi.mock("../../../src/ts/states/page-transition", () => ({ get: () => false }));
vi.mock("../../../src/ts/utils/json-data", () => ({
  getLanguage: async () =>
    ({ name: "english", words: ["hello", "world"] }) as LanguageObject,
  checkIfLanguageSupportsZipf: async () => "yes",
}));
vi.mock("../../../src/ts/test/test-ui", () => ({
  onTestStart: vi.fn(),
  fadeOutForRestart: vi.fn().mockResolvedValue(undefined),
  fadeInAfterRestart: vi.fn().mockResolvedValue(undefined),
  onTestRestart: vi.fn(),
  onTestFinish: vi.fn(),
  setJoiningClass: vi.fn(),
  appendEmptyWordElement: vi.fn(),
  addWord: vi.fn(),
}));
vi.mock("../../../src/ts/test/words-generator", () => ({
  generateWords: async () => ({
    words: [...mocks.generatedWords],
    sectionIndexes: mocks.generatedWords.map(() => 0),
    hasTab: false,
    hasNewline: false,
  }),
  areAllWordsGenerated: () => true,
  appendCommitCharacter: (word: string) => `${word} `,
}));
vi.mock("../../../src/ts/test/funbox/list", () => ({
  getActiveFunboxes: () => [],
  getActiveFunboxesWithFunction: () => [],
  getActiveFunboxNames: () => [],
  findSingleActiveFunboxWithFunction: () => undefined,
  isFunboxActive: () => false,
  isFunboxActiveWithProperty: () => false,
}));
vi.mock("../../../src/ts/test/funbox/active", () => ({
  isFunboxActiveWithProperty: () => false,
}));
vi.mock("../../../src/ts/test/funbox/funbox", () => ({
  rememberSettings: vi.fn().mockResolvedValue(undefined),
  activate: vi.fn().mockResolvedValue(undefined),
  toggleScript: vi.fn(),
}));
vi.mock("../../../src/ts/test/pace-caret", () => ({
  start: mocks.paceStart,
  reset: mocks.paceReset,
  init: mocks.paceInit,
  setLastTestWpm: mocks.paceLastWpm,
}));
vi.mock("../../../src/ts/test/caret", () => ({ hide: mocks.caretHide }));
vi.mock("../../../src/ts/test/replay", () => ({ pauseReplay: vi.fn() }));
vi.mock("../../../src/ts/test/practise-words", () => ({
  before: { mode: null },
  resetBefore: vi.fn(),
}));
vi.mock("../../../src/ts/test/today-tracker", () => ({
  addSeconds: mocks.todaySeconds,
}));
vi.mock("../../../src/ts/test/result", () => ({
  update: mocks.resultUpdate,
  updateRetrySaving: vi.fn(),
  updateTodayTracker: vi.fn(),
  updateSavedResultId: vi.fn(),
  updateDailyLeaderboardRank: vi.fn(),
  showErrorCrownIfNeeded: vi.fn(),
  showCrown: vi.fn(),
  showConfetti: vi.fn(),
}));
vi.mock("../../../src/ts/states/result", () => ({
  prepareResultScreen: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../src/ts/states/notifications", () => ({
  showNoticeNotification: mocks.notice,
  showErrorNotification: mocks.error,
  showSuccessNotification: vi.fn(),
  removeNotification: vi.fn(),
}));
vi.mock("../../../src/ts/states/remember-lazy-mode", () => ({
  getRemember: () => false,
  setRemember: vi.fn(),
  getArabicPref: () => false,
  setArabicPref: vi.fn(),
}));
vi.mock("../../../src/ts/config/setters", async () => {
  const { getMutableConfig } = await import("../../../src/ts/config/store");
  return {
    setConfig: (
      key: keyof ReturnType<typeof getMutableConfig>,
      value: unknown,
    ) => {
      Object.assign(getMutableConfig(), { [key]: value });
    },
    setQuoteLengthAll: vi.fn(),
    toggleFunbox: vi.fn(),
  };
});
vi.mock("../../../src/ts/db", () => ({
  getSnapshot: () => undefined,
  saveLocalResult: vi.fn(),
  getLocalPB: () => undefined,
}));
vi.mock("../../../src/ts/ape", () => ({
  default: { results: { add: vi.fn() } },
}));
vi.mock("../../../src/ts/controllers/challenge-controller", () => ({
  verify: () => null,
}));
vi.mock("../../../src/ts/controllers/analytics-controller", () => ({
  log: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../src/ts/controllers/sound-controller", () => ({
  playTimeWarning: mocks.timeWarning,
}));
vi.mock("../../../src/ts/states/quote-rate", () => ({
  clearQuoteStats: vi.fn(),
}));
vi.mock("../../../src/ts/states/loader-bar", () => ({
  showLoaderBar: vi.fn(),
  hideLoaderBar: vi.fn(),
}));
vi.mock("../../../src/ts/states/modifiers", () => ({
  resetModifierState: vi.fn(),
}));
vi.mock("../../../src/ts/sentry", () => ({ captureException: vi.fn() }));
vi.mock("../../../src/ts/anim", () => ({
  animateAsync: vi.fn().mockResolvedValue(undefined),
  setLowFpsMode: mocks.lowFps,
  clearLowFpsMode: vi.fn(),
}));
vi.mock("../../../src/ts/utils/result-hash", () => ({
  hashResult: vi.fn().mockResolvedValue("hash"),
  preloadResultHasher: vi.fn().mockResolvedValue(undefined),
}));

import { getMutableConfig } from "../../../src/ts/config/store";
import { getDefaultConfig } from "../../../src/ts/constants/default-config";
import {
  getAllTestEvents,
  logTestEvent,
} from "../../../src/ts/test/events/data";
import * as SlowTimer from "../../../src/ts/states/slow-timer";
import * as CustomText from "../../../src/ts/test/custom-text";
import {
  restart,
  startTest,
  useTestLogicEvents,
} from "../../../src/ts/test/test-logic";

function type(
  now: number,
  wordIndex: number,
  typed: string,
  correct = true,
): void {
  logTestEvent("input", now, {
    inputType: "insertText",
    data: typed.at(-1) ?? "",
    correct,
    wordIndex,
    charIndex: typed.length - 1,
    inputValue: typed,
  });
}

function timerEvents(): string[] {
  return getAllTestEvents()
    .filter((event) => event.type === "timer")
    .map((event) =>
      event.type === "timer"
        ? `${event.data.event}:${event.data.timer}@${event.testMs}`
        : "",
    )
    .sort();
}

function failReason(): unknown {
  return mocks.resultUpdate.mock.calls.at(-1)?.[2];
}

let disposeRuntime: () => void;
afterEach(() => disposeRuntime());
beforeEach(async () => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "performance", "Date"],
  });
  vi.clearAllMocks();
  disposeRuntime = createRoot((dispose) => {
    useTestLogicEvents();
    return dispose;
  });
  Object.assign(mocks, {
    active: false,
    restarting: false,
    calculating: false,
    wordIndex: 0,
    liveStats: [],
    lastEventLog: undefined,
    generatedWords: ["hello ", "world "],
  });
  mocks.resultUpdate.mockResolvedValue(undefined);
  Object.assign(getMutableConfig(), getDefaultConfig(), {
    mode: "time",
    time: 3,
    language: "english",
    resultSaving: true,
  });
  CustomText.setLimitMode("word");
  CustomText.setLimitValue(9);
  SlowTimer.clear();
  await restart();
});
afterEach(() => vi.useRealTimers());

describe("timing", () => {
  it("logs the start, one step per second and live stats from the event log", () => {
    const start = performance.now();
    expect(startTest(start)).toBe(true);
    expect(mocks.active).toBe(true);
    type(start + 100, 0, "h");
    type(start + 200, 0, "he");
    type(start + 300, 0, "hx", false);
    vi.advanceTimersByTime(999);
    expect(timerEvents()).toEqual([`start:0@0`]);
    vi.advanceTimersByTime(1);
    expect(timerEvents()).toEqual([`start:0@0`, `step:1@1000`]);
    expect(mocks.liveStats).toEqual([
      { wpm: 0, raw: 24, acc: (2 / 3) * 100, seconds: 1 },
    ]);
    vi.advanceTimersByTime(1000);
    expect(mocks.liveStats.at(-1)).toEqual({
      wpm: 0,
      raw: 12,
      acc: (2 / 3) * 100,
      seconds: 2,
    });
  });

  it("logs the timer start date from the wall clock", () => {
    vi.setSystemTime(new Date("2026-01-02T03:04:05Z"));
    startTest(performance.now());
    const startEvent = getAllTestEvents().find(
      (event) => event.type === "timer" && event.data.event === "start",
    );
    expect(startEvent?.data).toEqual({
      event: "start",
      timer: 0,
      date: new Date("2026-01-02T03:04:05Z").getTime(),
    });
  });

  it("plays the time warning on the configured second", () => {
    getMutableConfig().time = 15;
    getMutableConfig().playTimeWarning = "5";
    startTest(performance.now());
    vi.advanceTimersByTime(9000);
    expect(mocks.timeWarning).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(mocks.timeWarning).toHaveBeenCalledOnce();
  });

  it("catches up stalled seconds without recomputing live stats for each", () => {
    // Long tests skip the slow timer guard.
    getMutableConfig().time = 200;
    const start = performance.now();
    startTest(start);
    const now = vi.spyOn(performance, "now").mockReturnValue(start + 3200);
    vi.advanceTimersByTime(1000);
    const steps = getAllTestEvents().filter(
      (event) => event.type === "timer" && event.data.event === "step",
    );
    expect(steps.map((event) => event.data)).toEqual([
      { event: "step", timer: 1, catchup: true },
      { event: "step", timer: 2, catchup: true },
      { event: "step", timer: 3, drift: 2200 },
    ]);
    expect(mocks.liveStats).toHaveLength(1);
    now.mockRestore();
  });
});

describe("completion", () => {
  it("finishes once when time runs out with a single end event", async () => {
    const start = performance.now();
    startTest(start);
    type(start + 100, 0, "h");
    vi.advanceTimersByTime(3000);
    await vi.waitFor(() => expect(mocks.resultUpdate).toHaveBeenCalled());
    expect(mocks.caretHide).toHaveBeenCalled();
    expect(timerEvents()).toEqual([
      "end:3@3000",
      "start:0@0",
      "step:1@1000",
      "step:2@2000",
      "step:3@3000",
    ]);
    expect(failReason()).toBe("");
    expect(mocks.lastEventLog?.events).toEqual(getAllTestEvents());
    vi.advanceTimersByTime(5000);
    expect(mocks.resultUpdate).toHaveBeenCalledOnce();
    expect(timerEvents()).toHaveLength(5);
  });

  it("counts custom time limits", async () => {
    getMutableConfig().mode = "custom";
    CustomText.setLimitMode("time");
    CustomText.setLimitValue(2);
    startTest(performance.now());
    vi.advanceTimersByTime(2000);
    await vi.waitFor(() => expect(mocks.resultUpdate).toHaveBeenCalled());
    expect(timerEvents()).toContain("end:2@2000");
  });

  it("keeps running without a time limit", () => {
    getMutableConfig().mode = "words";
    getMutableConfig().words = 10;
    startTest(performance.now());
    vi.advanceTimersByTime(30_000);
    expect(mocks.resultUpdate).not.toHaveBeenCalled();
    expect(timerEvents()).toHaveLength(31);
  });

  it("adds active, non-AFK seconds to today's typing time", async () => {
    const start = performance.now();
    startTest(start);
    type(start + 100, 0, "h");
    vi.advanceTimersByTime(3000);
    await vi.waitFor(() => expect(mocks.todaySeconds).toHaveBeenCalled());
    expect(mocks.todaySeconds).toHaveBeenCalledWith(1);
  });
});

describe("failure", () => {
  it("fails on minimum accuracy at the next second", async () => {
    getMutableConfig().minAcc = "custom";
    getMutableConfig().minAccCustom = 90;
    const start = performance.now();
    startTest(start);
    type(start + 100, 0, "h");
    type(start + 200, 0, "hx", false);
    vi.advanceTimersByTime(1000);
    await vi.waitFor(() => expect(mocks.resultUpdate).toHaveBeenCalled());
    expect(failReason()).toBe("min accuracy");
    expect(mocks.notice).toHaveBeenCalledWith("Test failed - min accuracy", {
      durationMs: 1000,
    });
    expect(timerEvents()).toEqual(["end:1@1000", "start:0@0", "step:1@1000"]);
  });

  it("does not fail minimum accuracy before any input", () => {
    getMutableConfig().minAcc = "custom";
    getMutableConfig().minAccCustom = 90;
    startTest(performance.now());
    vi.advanceTimersByTime(2000);
    expect(mocks.resultUpdate).not.toHaveBeenCalled();
  });

  it("fails on minimum speed only after the fourth word", async () => {
    getMutableConfig().minWpm = "custom";
    getMutableConfig().minWpmCustomSpeed = 100;
    const start = performance.now();
    startTest(start);
    type(start + 100, 0, "h");
    mocks.wordIndex = 3;
    vi.advanceTimersByTime(1000);
    expect(mocks.resultUpdate).not.toHaveBeenCalled();
    mocks.wordIndex = 4;
    vi.advanceTimersByTime(1000);
    await vi.waitFor(() => expect(mocks.resultUpdate).toHaveBeenCalled());
    expect(failReason()).toBe("min speed");
  });

  it("fails a slow timer and flags slow steps", async () => {
    getMutableConfig().time = 10;
    const start = performance.now();
    startTest(start);
    const now = vi.spyOn(performance, "now").mockReturnValue(start + 1150);
    vi.advanceTimersByTime(1000);
    expect(SlowTimer.get()).toBe(true);
    expect(mocks.lowFps).toHaveBeenCalled();
    const step = getAllTestEvents().find(
      (event) => event.type === "timer" && event.data.event === "step",
    );
    expect(step?.data).toEqual({
      event: "step",
      timer: 1,
      drift: 150,
      slowTimer: true,
    });
    now.mockReturnValue(start + 2700);
    vi.advanceTimersByTime(1000);
    await vi.waitFor(() => expect(mocks.resultUpdate).toHaveBeenCalled());
    expect(failReason()).toBe("slow timer");
    expect(mocks.error).toHaveBeenCalledWith(
      "Stopping the test due to bad performance. This would cause test calculations to be incorrect. If this happens a lot, please report this.",
    );
    now.mockRestore();
  });
});

describe("restart", () => {
  it("records an abandoned test with its accuracy and active seconds", async () => {
    getMutableConfig().time = 30;
    const start = performance.now();
    startTest(start);
    type(start + 100, 0, "h");
    type(start + 200, 0, "hx", false);
    type(start + 300, 0, "hxl");
    vi.advanceTimersByTime(2500);
    await restart();
    expect(mocks.incomplete).toHaveBeenCalledWith({ acc: 66.67, seconds: 1.5 });
    expect(getAllTestEvents()).toEqual([]);
    expect(mocks.active).toBe(false);
    vi.advanceTimersByTime(5000);
    expect(getAllTestEvents()).toEqual([]);
  });

  it("does not record an abandoned test when result saving is off", async () => {
    getMutableConfig().resultSaving = false;
    startTest(performance.now());
    vi.advanceTimersByTime(1500);
    await restart();
    expect(mocks.incomplete).not.toHaveBeenCalled();
  });

  it("starts the next test from a fresh clock", async () => {
    getMutableConfig().time = 30;
    startTest(performance.now());
    vi.advanceTimersByTime(2500);
    await restart();
    vi.advanceTimersByTime(700);
    const start = performance.now();
    startTest(start);
    vi.advanceTimersByTime(1000);
    expect(timerEvents()).toEqual(["start:0@0", "step:1@1000"]);
  });

  it("resets the pace caret and clears the failure reason", async () => {
    getMutableConfig().minAcc = "custom";
    getMutableConfig().minAccCustom = 90;
    const start = performance.now();
    startTest(start);
    type(start + 100, 0, "x", false);
    vi.advanceTimersByTime(1000);
    await vi.waitFor(() => expect(failReason()).toBe("min accuracy"));
    mocks.calculating = false;
    getMutableConfig().minAcc = "off";
    await restart();
    expect(mocks.paceReset).toHaveBeenCalled();
    expect(mocks.paceInit).toHaveBeenCalled();
    const next = performance.now();
    startTest(next);
    type(next + 100, 0, "h");
    vi.advanceTimersByTime(3000);
    await vi.waitFor(() => expect(mocks.resultUpdate).toHaveBeenCalledTimes(2));
    expect(failReason()).toBe("");
  });
});
