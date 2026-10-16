import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

vi.mock("../../../src/ts/controllers/ad-controller", () => ({
  updateFooterAndVerticalAds: vi.fn(),
  destroyResult: vi.fn(),
}));
vi.mock("../../../src/ts/controllers/sound-controller", () => ({
  clearAllSounds: vi.fn(),
}));
vi.mock("../../../src/ts/controllers/theme-controller", () => ({
  randomizeTheme: vi.fn(),
}));
vi.mock("../../../src/features/typing/components/MonkeyPower", () => ({
  reset: vi.fn(),
}));
vi.mock("../../../src/features/typing/runtime/caret", () => ({
  resetPosition: vi.fn(),
  updatePosition: vi.fn(),
}));
vi.mock("../../../src/features/typing/runtime/pace-caret", () => ({
  resetCaretPosition: vi.fn(),
}));
vi.mock("../../../src/features/typing/runtime/focus", () => ({ set: vi.fn() }));
vi.mock("../../../src/ts/utils/debounced-animation-frame", () => ({
  requestDebouncedAnimationFrame: vi.fn(),
  cancelPendingAnimationFramesStartingWith: vi.fn(),
}));
vi.mock("../../../src/ts/states/connection", () => ({
  get: () => true,
}));

import { __testing } from "../../../src/ts/config/testing";
import {
  areWordsVisible,
  isWordsWrapperVisible,
  setWordsVisible,
  setWordsWrapperVisible,
} from "../../../src/ts/states/funbox";
import {
  getMemoryTimerText,
  getMemoryTimerVisibility,
} from "../../../src/ts/states/funbox-timers";
import { setResultElements } from "../../../src/ts/states/result";
import * as Funbox from "../../../src/features/typing/runtime/funbox/funbox";
import { getActiveFunboxesWithFunction } from "../../../src/features/typing/runtime/funbox/list";
import * as MemoryTimer from "../../../src/features/typing/runtime/funbox/memory-funbox-timer";
import * as TestUI from "../../../src/features/typing/runtime/test-ui";
import { words } from "../../../src/features/typing/runtime/test-words";
import * as JSONData from "../../../src/ts/utils/json-data";

beforeEach(() => {
  vi.useFakeTimers();
  __testing.replaceConfig({ mode: "words", funbox: ["memory"] });
  MemoryTimer.reset();
  setWordsVisible(true);
  setWordsWrapperVisible(true);
  setResultElements(
    document.createElement("div"),
    document.createElement("div"),
  );
  words.reset();
  for (const word of ["one", "two", "three"]) words.push(word, 0);
});

afterEach(() => {
  MemoryTimer.reset();
  words.reset();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function restart(source: "testPage" | "resultPage" = "testPage"): void {
  for (const funbox of getActiveFunboxesWithFunction("restart")) {
    funbox.functions.restart();
  }
  TestUI.onTestRestart(source);
}

describe("memory funbox lifecycle", () => {
  it.each(["testPage", "resultPage"] as const)(
    "keeps counting down after restarting from %s",
    (source) => {
      restart(source);

      expect(getMemoryTimerVisibility()).toBe("shown");
      expect(getMemoryTimerText()).toBe("Timer left to memorise all words: 4s");
      expect(areWordsVisible()).toBe(true);
      expect(isWordsWrapperVisible()).toBe(true);

      vi.advanceTimersByTime(1000);
      expect(getMemoryTimerText()).toBe("Timer left to memorise all words: 3s");

      vi.advanceTimersByTime(3000);
      expect(getMemoryTimerVisibility()).toBe("hidden");
      expect(isWordsWrapperVisible()).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("restarts memorisation without keeping the previous countdown", () => {
    restart();
    vi.advanceTimersByTime(3000);

    restart();
    expect(getMemoryTimerText()).toBe("Timer left to memorise all words: 4s");
    expect(getMemoryTimerVisibility()).toBe("shown");

    vi.advanceTimersByTime(1000);
    expect(getMemoryTimerText()).toBe("Timer left to memorise all words: 3s");
    expect(isWordsWrapperVisible()).toBe(true);

    vi.advanceTimersByTime(3000);
    expect(getMemoryTimerVisibility()).toBe("hidden");
    expect(isWordsWrapperVisible()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ends memorisation when typing starts before the countdown expires", () => {
    restart();
    vi.advanceTimersByTime(1000);

    for (const funbox of getActiveFunboxesWithFunction("start")) {
      funbox.functions.start();
    }

    expect(getMemoryTimerVisibility()).toBe("hidden");
    expect(areWordsVisible()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(10000);
    expect(isWordsWrapperVisible()).toBe(true);
    expect(areWordsVisible()).toBe(false);
  });

  it("cancels memorisation when funboxes are cleared", async () => {
    restart();
    vi.advanceTimersByTime(1000);

    await Funbox.clear();
    expect(getMemoryTimerVisibility()).toBe("hidden");
    expect(isWordsWrapperVisible()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(10000);
    expect(isWordsWrapperVisible()).toBe(true);
  });

  it("cancels the old countdown when activating without memory", async () => {
    vi.spyOn(JSONData, "getCurrentLanguage").mockResolvedValue({
      name: "english",
      words: ["one", "two", "three"],
    });
    restart();
    vi.advanceTimersByTime(1000);

    await Funbox.activate([]);
    expect(getMemoryTimerVisibility()).toBe("hidden");
    expect(isWordsWrapperVisible()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    TestUI.onTestRestart("testPage");
    vi.advanceTimersByTime(10000);
    expect(isWordsWrapperVisible()).toBe(true);
    expect(getMemoryTimerVisibility()).toBe("hidden");
  });
});
