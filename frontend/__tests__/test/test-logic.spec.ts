import { animateAsync } from "../../src/ts/anim";
import { requireApplication } from "../../src/app/application";
import { bindTypingActivity } from "../../src/features/typing/scope";
import { createRoot, onCleanup } from "solid-js";
import type { QuoteWithTextSplit } from "@oxytype/typing-core/quotes";
import type { LanguageObject } from "@oxytype/schemas/languages";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

const mocks = vi.hoisted(() => ({
  active: false,
  restarting: false,
  calculating: false,
  repeated: false,
  transition: false,
  user: null as { uid: string } | null,
  quote: null as QuoteWithTextSplit | null,
  language: {} as LanguageObject,
  rememberLazy: false,
  noQuit: false,
  inputAccuracy: 96.789,
  generatedWords: ["hello ", "world"],
  generate: vi.fn(),
  complete: vi.fn(),
  sessionStart: vi.fn(),
  uiRestart: vi.fn(),
  uiStart: vi.fn(),
  notice: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  setInitError: vi.fn(),
  korean: vi.fn(),
  incomplete: vi.fn(),
  resultUpdate: vi.fn(),
  retryUpdate: vi.fn(),
  signedOut: vi.fn(),
  addResult: vi.fn(),
  capture: vi.fn(),
  saveLocal: vi.fn(),
  finishReason: undefined as string | undefined,
  onFinish: undefined as ((event: { reason?: string }) => void) | undefined,
}));

vi.mock("../../src/ts/states/test", () => ({
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
  isRepeated: () => mocks.repeated,
  setIsRepeated: (value: boolean) => {
    mocks.repeated = value;
  },
  getCurrentQuote: () => mocks.quote,
  getActiveWordIndex: () => 0,
  resetActiveWordIndex: vi.fn(),
  getResultVisible: () => false,
  getBailedOut: () => false,
  isPaceRepeat: () => false,
  getIncompleteSeconds: () => 0,
  getIncompleteTests: () => [],
  getRestartCount: () => 0,
  pushIncompleteTest: mocks.incomplete,
  resetIncompleteTests: vi.fn(),
  setKoreanStatus: mocks.korean,
  setLastEventLog: vi.fn(),
  setIsPaceRepeat: vi.fn(),
  setIsTestInvalid: vi.fn(),
  setLastResult: vi.fn(),
  setBailedOut: vi.fn(),
  setLastSignedOutResult: mocks.signedOut,
  setResultLoading: vi.fn(),
  setResultVisible: vi.fn(),
  setWordsHaveNewline: vi.fn(),
  setWordsHaveNumbers: vi.fn(),
  setWordsHaveTab: vi.fn(),
  setIsDirectionReversed: vi.fn(),
  setIsLanguageRightToLeft: vi.fn(),
  setTestInitError: mocks.setInitError,
}));
vi.mock("../../src/ts/states/core", () => ({
  getActivePage: () => "test",
  getCustomTextIndicator: () => undefined,
  isAuthenticated: () => mocks.user !== null,
}));
vi.mock("../../src/ts/auth-client", () => ({
  getAuthenticatedUser: () => mocks.user,
}));
vi.mock("../../src/ts/states/page-transition", () => ({
  get: () => mocks.transition,
}));
vi.mock("../../src/ts/utils/json-data", () => ({
  getLanguage: async () => mocks.language,
  checkIfLanguageSupportsZipf: async () => "yes",
}));
vi.mock("../../src/features/typing/runtime/test-ui", () => ({
  onTestStart: mocks.uiStart,
  fadeOutForRestart: vi.fn().mockResolvedValue(undefined),
  fadeInAfterRestart: vi.fn().mockResolvedValue(undefined),
  onTestRestart: mocks.uiRestart,
  onTestFinish: vi.fn(),
  setJoiningClass: vi.fn(),
  appendEmptyWordElement: vi.fn(),
  addWord: vi.fn(),
}));
vi.mock("../../src/features/typing/runtime/events/data", () => ({
  getTestSession: (() => {
    const session = {
      start: mocks.sessionStart,
      generate: mocks.generate,
      complete: mocks.complete,
      end: vi.fn(),
      abandon: () => ({ acc: mocks.inputAccuracy, seconds: 0 }),
      finish: (_now: number, reason?: string) => {
        mocks.finishReason = reason;
        mocks.onFinish?.({ reason });
      },
      getFinishReason: () => mocks.finishReason,
      on: (_type: "finish", listener: (event: { reason?: string }) => void) => {
        mocks.onFinish = listener;
        return () => undefined;
      },
    };
    return () => session;
  })(),
  resetTestEvents: () => {
    mocks.finishReason = undefined;
  },
  cleanupData: vi.fn(),
  logEventsDataToTheConsoleTable: vi.fn(),
  forceReleaseAllKeys: vi.fn(),
  buildEventLog: () => ({
    events: [],
    context: { targetWords: mocks.generatedWords },
  }),
}));
vi.mock("../../src/features/typing/runtime/words-generator", () => ({
  areAllWordsGenerated: () => true,
}));
vi.mock("../../src/features/typing/runtime/funbox/list", () => ({
  getActiveFunboxes: () => [],
  getActiveFunboxesWithFunction: () => [],
  getActiveFunboxNames: () => [],
  findSingleActiveFunboxWithFunction: () => undefined,
  isFunboxActive: (name: string) => name === "no_quit" && mocks.noQuit,
  isFunboxActiveWithProperty: () => false,
}));
vi.mock("../../src/features/typing/runtime/funbox/funbox", () => ({
  rememberSettings: vi.fn().mockResolvedValue(undefined),
  activate: vi.fn().mockResolvedValue(undefined),
  toggleScript: vi.fn(),
}));
vi.mock("../../src/features/typing/runtime/pace-caret", () => ({
  start: vi.fn(),
  reset: vi.fn(),
  init: vi.fn().mockResolvedValue(undefined),
  setLastTestWpm: vi.fn(),
}));
vi.mock("../../src/features/typing/runtime/test-timer", () => ({
  clear: vi.fn(),
  start: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/features/typing/runtime/replay", () => ({
  pauseReplay: vi.fn(),
}));
vi.mock("../../src/features/typing/runtime/practise-words", () => ({
  before: { mode: null },
  resetBefore: vi.fn(),
}));
vi.mock("../../src/features/typing/runtime/today-tracker", () => ({
  addSeconds: vi.fn(),
}));
vi.mock("../../src/features/typing/runtime/result", () => ({
  update: mocks.resultUpdate,
  updateRetrySaving: mocks.retryUpdate,
  updateTodayTracker: vi.fn(),
  updateSavedResultId: vi.fn(),
  updateDailyLeaderboardRank: vi.fn(),
  showErrorCrownIfNeeded: vi.fn(),
  showCrown: vi.fn(),
  showConfetti: vi.fn(),
}));
vi.mock("../../src/ts/states/notifications", () => ({
  showNoticeNotification: mocks.notice,
  showErrorNotification: mocks.error,
  showSuccessNotification: mocks.success,
}));
vi.mock("../../src/ts/states/remember-lazy-mode", () => ({
  getRemember: () => mocks.rememberLazy,
  setRemember: (value: boolean) => {
    mocks.rememberLazy = value;
  },
  getArabicPref: () => false,
  setArabicPref: vi.fn(),
}));
vi.mock("../../src/ts/config/setters", async () => {
  const { getMutableConfig } = await import("../../src/ts/config/store");
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
vi.mock("../../src/ts/db", () => ({
  getSnapshot: () => undefined,
  saveLocalResult: mocks.saveLocal,
  getLocalPB: () => undefined,
}));
vi.mock("../../src/ts/ape", () => ({
  default: { results: { add: mocks.addResult } },
}));
vi.mock("../../src/ts/collections/tags", () => ({ getActiveTags: () => [] }));
vi.mock("../../src/ts/controllers/challenge-controller", () => ({
  verify: () => null,
}));
vi.mock("../../src/ts/controllers/analytics-controller", () => ({
  log: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/ts/states/quote-rate", () => ({ clearQuoteStats: vi.fn() }));
vi.mock("../../src/ts/states/loader-bar", () => ({
  showLoaderBar: vi.fn(),
  hideLoaderBar: vi.fn(),
}));
vi.mock("../../src/ts/states/header", () => ({
  setAccountButtonSpinner: vi.fn(),
}));
vi.mock("../../src/ts/states/modifiers", () => ({
  resetModifierState: vi.fn(),
}));
vi.mock("../../src/ts/sentry", () => ({ captureException: mocks.capture }));
vi.mock("../../src/ts/anim", () => ({
  animateAsync: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../src/ts/utils/result-hash", () => ({
  hashResult: vi.fn().mockResolvedValue("hash"),
  preloadResultHasher: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@oxytype/typing-core/result-validity", () => ({
  getInvalidResultReason: () => undefined,
  isAfkResult: () => false,
}));

import { getMutableConfig } from "../../src/ts/config/store";
import { getDefaultConfig } from "../../src/ts/constants/default-config";
import {
  fail,
  finish,
  restart,
  retrySavingResult,
  startTest,
  useTestLogicEvents,
} from "../../src/features/typing/runtime/test-logic";

let disposeRuntime: () => void;
afterEach(() => disposeRuntime());
beforeEach(() => {
  vi.clearAllMocks();
  disposeRuntime = createRoot((dispose) => {
    onCleanup(bindTypingActivity(() => !mocks.transition));
    useTestLogicEvents();
    return dispose;
  });
  Object.assign(mocks, {
    active: false,
    restarting: false,
    calculating: false,
    repeated: false,
    transition: false,
    user: null,
    quote: null,
    rememberLazy: false,
    noQuit: false,
    generatedWords: ["hello ", "world"],
    language: { name: "english", words: ["hello", "world"] },
  });
  Object.assign(getMutableConfig(), getDefaultConfig(), {
    mode: "words",
    words: 15,
    language: "english",
    resultSaving: true,
  });
  mocks.generate.mockImplementation(async () => ({
    words: mocks.generatedWords,
    sectionIndexes: [0, 0],
    hasTab: false,
    hasNewline: false,
  }));
  mocks.complete.mockReturnValue({
    wpm: 80,
    rawWpm: 80,
    acc: 100,
    testDuration: 15,
    afkDuration: 0,
    mode: "words",
    mode2: "15",
    language: "english",
    funbox: [],
    punctuation: false,
    numbers: false,
    difficulty: "normal",
    lazyMode: false,
  });
  mocks.addResult.mockResolvedValue({ status: 200, body: { data: {} } });
  mocks.resultUpdate.mockResolvedValue(undefined);
});

describe("test lifecycle state", () => {
  it("saves the completed payload with its server ID before collection normalization", async () => {
    mocks.user = { uid: "user" };
    mocks.active = true;
    mocks.addResult.mockResolvedValue({
      status: 200,
      body: { data: { insertedId: "saved-result", isPb: true } },
    });
    await finish();
    const saved = mocks.saveLocal.mock.calls[0]?.[0].result;
    expect(saved).toMatchObject({
      _id: "saved-result",
      uid: "user",
      hash: "hash",
      isPb: true,
      wpm: 80,
    });
    expect(saved).not.toHaveProperty("words");
    expect(saved).not.toHaveProperty("timeTyping");
    expect(saved).not.toHaveProperty("dayTimestamp");
  });
  it("rejects starts outside the active typing route", () => {
    mocks.transition = true;
    expect(startTest(100)).toBe(false);
    expect(mocks.sessionStart).not.toHaveBeenCalled();
    mocks.transition = false;
    expect(startTest(100)).toBe(true);
    expect(mocks.sessionStart).toHaveBeenCalledWith(100);
    expect(mocks.uiStart).toHaveBeenCalledOnce();
  });

  it.each(["restarting", "calculating", "noQuit"] as const)(
    "rejects restarts while %s",
    async (guard) => {
      mocks[guard] = true;
      mocks.active = true;
      const event = { preventDefault: vi.fn() } as unknown as KeyboardEvent;
      await restart({ event });
      expect(event.preventDefault).toHaveBeenCalledOnce();
      expect(mocks.generate).not.toHaveBeenCalled();
    },
  );

  it("caps initialization retries and starts a fresh retry budget on restart", async () => {
    const error = new Error("generation failed");
    mocks.generate.mockRejectedValue(error);
    await restart();
    expect(mocks.generate).toHaveBeenCalledTimes(3);
    expect(mocks.setInitError).toHaveBeenCalledWith({
      message: "Error: generation failed",
    });
    expect(mocks.capture).toHaveBeenCalledWith(error);
    expect(mocks.restarting).toBe(false);
    mocks.generate.mockResolvedValue({
      words: ["ok"],
      sectionIndexes: [0],
      hasTab: false,
      hasNewline: false,
    });
    await restart();
    expect(mocks.generate).toHaveBeenCalledTimes(4);
    expect(mocks.uiRestart).toHaveBeenCalledWith("testPage");
  });

  it("remembers a lazy-mode notice until lazy mode becomes available", async () => {
    mocks.language.noLazyMode = true;
    getMutableConfig().lazyMode = true;
    await restart();
    expect(getMutableConfig().lazyMode).toBe(false);
    expect(mocks.rememberLazy).toBe(true);
    getMutableConfig().lazyMode = true;
    await restart();
    expect(mocks.notice).toHaveBeenCalledTimes(1);
    mocks.language.noLazyMode = false;
    await restart();
    expect(getMutableConfig().lazyMode).toBe(true);
    expect(mocks.rememberLazy).toBe(false);
    mocks.language.noLazyMode = true;
    await restart();
    expect(mocks.notice).toHaveBeenCalledTimes(2);
    mocks.language.noLazyMode = false;
    await restart();
  });

  it("clears the failure reason on restart", async () => {
    mocks.active = true;
    fail("min wpm");
    await vi.waitFor(() => expect(mocks.resultUpdate).toHaveBeenCalled());
    expect(mocks.resultUpdate.mock.calls[0]?.[2]).toBe("min wpm");
    mocks.calculating = false;
    await restart();
    mocks.active = true;
    await finish();
    expect(mocks.resultUpdate.mock.calls[1]?.[2]).toBe("");
  });

  it("allows one save retry until another retryable response arrives", async () => {
    mocks.user = { uid: "user" };
    mocks.active = true;
    mocks.addResult.mockResolvedValueOnce({
      status: 500,
      body: { message: "Unavailable" },
    });
    await finish();
    expect(mocks.retryUpdate).toHaveBeenCalledWith(true);
    await retrySavingResult();
    expect(mocks.addResult).toHaveBeenCalledTimes(2);
    await retrySavingResult();
    expect(mocks.addResult).toHaveBeenCalledTimes(2);
    expect(mocks.success).toHaveBeenCalledWith("Result saved", {
      important: true,
    });
  });
});

describe("shared test decisions", () => {
  it.each([
    ["hello", false],
    ["한글", true],
    ["한", true],
    ["ㄱ", true],
    ["\ua960", true],
    ["\ud7b0", true],
    ["日本語", false],
  ] as const)("detects Korean text in %s", async (text, expected) => {
    mocks.generatedWords = [text];
    await restart();
    expect(mocks.korean).toHaveBeenLastCalledWith(expected);
  });

  it.each(["off", "typing"] as const)(
    "preserves repeatQuotes=%s on an active quote restart",
    async (repeatQuotes) => {
      getMutableConfig().mode = "quote";
      getMutableConfig().repeatQuotes = repeatQuotes;
      mocks.quote = { language: "english", id: 1 } as QuoteWithTextSplit;
      mocks.active = true;
      await restart();
      expect(mocks.repeated).toBe(repeatQuotes === "typing");
    },
  );

  it("does not repeat a quote after changing its language", async () => {
    getMutableConfig().mode = "quote";
    getMutableConfig().repeatQuotes = "typing";
    mocks.quote = { language: "spanish", id: 1 } as QuoteWithTextSplit;
    mocks.active = true;
    await restart();
    expect(mocks.repeated).toBe(false);
  });

  it("rejects undefined and NaN completed fields before saving", async () => {
    mocks.complete.mockReturnValue({ wpm: NaN, nested: [undefined] });
    mocks.active = true;
    await finish();
    expect(mocks.error).toHaveBeenCalledWith(
      "Failed to build result object: One of the fields is undefined or NaN",
    );
    expect(mocks.signedOut).not.toHaveBeenCalled();
  });
});

it("drops completion presentation after forced navigation during the fade", async () => {
  let resolve!: () => void;
  vi.mocked(animateAsync).mockImplementationOnce(
    async () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  mocks.active = true;
  const completion = finish();
  mocks.transition = true;
  resolve();
  await completion;
  expect(mocks.resultUpdate).not.toHaveBeenCalled();
  expect(mocks.addResult).not.toHaveBeenCalled();
});

it("never applies a pending save acknowledgement to another actor", async () => {
  let resolve!: (value: {
    status: number;
    body: { data: { insertedId: string } };
  }) => void;
  mocks.addResult.mockImplementationOnce(
    async () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  mocks.user = { uid: "user" };
  mocks.active = true;
  const completion = finish();
  await vi.waitFor(() => expect(mocks.addResult).toHaveBeenCalledOnce());
  requireApplication().accountData.setActor("other-actor");
  resolve({ status: 200, body: { data: { insertedId: "old-actor-result" } } });
  await completion;
  expect(mocks.saveLocal).not.toHaveBeenCalled();
  requireApplication().accountData.setActor(null);
});
