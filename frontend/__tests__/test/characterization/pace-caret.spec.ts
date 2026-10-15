import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

// Characterizes how the web pace caret walks the words at a fixed speed.

type GoTo = {
  wordIndex: number;
  letterIndex: number;
  animate: boolean;
  animationOptions?: { duration: number; easing: string };
};

const mocks = vi.hoisted(() => ({
  active: false,
  resultVisible: false,
  paceRepeat: false,
  wordIndex: 0,
  paceWpm: undefined as number | undefined,
  hidden: true,
  goTo: [] as GoTo[],
  localPb: undefined as { wpm: number } | undefined,
}));

vi.mock("../../../src/ts/states/test", () => ({
  isTestActive: () => mocks.active,
  getResultVisible: () => mocks.resultVisible,
  isPaceRepeat: () => mocks.paceRepeat,
  getActiveWordIndex: () => mocks.wordIndex,
  isLanguageRightToLeft: () => false,
  isDirectionReversed: () => false,
  getCurrentQuote: () => null,
  setPaceCaretWpm: (wpm: number | undefined) => {
    mocks.paceWpm = wpm;
  },
}));
vi.mock("../../../src/ts/states/test-dom", () => ({
  areTestElementsMounted: () => false,
  getPaceCaretElement: () => document.createElement("div"),
}));
vi.mock("../../../src/ts/components/pages/test/words/caret-controller", () => ({
  CaretController: class {
    hide(): void {
      mocks.hidden = true;
    }
    show(): void {
      mocks.hidden = false;
    }
    isHidden(): boolean {
      return mocks.hidden;
    }
    stopAllAnimations = vi.fn();
    clearMargins = vi.fn();
    setStyle = vi.fn();
    goTo(options: GoTo): void {
      mocks.goTo.push(options);
    }
  },
}));
vi.mock("../../../src/ts/db", () => ({
  getLocalPB: () => mocks.localPb,
}));
vi.mock("../../../src/ts/test/funbox/list", () => ({
  getActiveFunboxes: () => [],
}));

import { getMutableConfig } from "../../../src/ts/config/store";
import { getDefaultConfig } from "../../../src/ts/constants/default-config";
import * as PaceCaret from "../../../src/ts/test/pace-caret";
import * as TestWords from "../../../src/ts/test/test-words";

function positions(): string[] {
  return mocks.goTo
    .filter((call) => call.animate)
    .map((call) => `${call.wordIndex}:${call.letterIndex}`);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  Object.assign(mocks, {
    active: true,
    resultVisible: false,
    paceRepeat: false,
    wordIndex: 0,
    paceWpm: undefined,
    hidden: true,
    goTo: [],
    localPb: undefined,
  });
  Object.assign(getMutableConfig(), getDefaultConfig(), {
    mode: "words",
    words: 3,
    paceCaret: "custom",
    // 60 wpm is one character every 200ms.
    paceCaretCustomSpeed: 60,
  });
  TestWords.words.reset();
  TestWords.words.push("hi ", 0);
  TestWords.words.push("you ", 0);
  TestWords.words.push("all", 0);
});
afterEach(() => {
  PaceCaret.reset();
  vi.useRealTimers();
});

describe("pace caret", () => {
  it("publishes the pace speed and steps one letter per character time", async () => {
    await PaceCaret.init();
    expect(mocks.paceWpm).toBe(60);
    PaceCaret.start();
    expect(mocks.hidden).toBe(false);
    expect(positions()).toEqual(["0:1"]);
    expect(mocks.goTo[0]?.animationOptions).toEqual({
      duration: 200,
      easing: "linear",
    });
    vi.advanceTimersByTime(200 * 6);
    expect(positions()).toEqual([
      "0:1",
      "0:2",
      "1:0",
      "1:1",
      "1:2",
      "1:3",
      "2:0",
    ]);
  });

  it("anchors each step to the start time instead of the previous step", async () => {
    await PaceCaret.init();
    const start = performance.now();
    PaceCaret.start();
    const now = vi.spyOn(performance, "now").mockReturnValue(start + 250);
    vi.advanceTimersByTime(200);
    expect(mocks.goTo.at(-1)?.animationOptions?.duration).toBe(150);
    now.mockRestore();
  });

  it("jumps ahead by the length of a mistyped word and back when corrected", async () => {
    await PaceCaret.init();
    PaceCaret.start();
    PaceCaret.handleSpace(false, "hi ");
    vi.advanceTimersByTime(200);
    expect(positions().at(-1)).toBe("1:2");
    PaceCaret.handleSpace(false, "hi ");
    PaceCaret.handleSpace(true, "hi ");
    vi.advanceTimersByTime(200);
    expect(positions().at(-1)).toBe("1:0");
  });

  it("ignores corrections in blind mode", async () => {
    getMutableConfig().blindMode = true;
    await PaceCaret.init();
    PaceCaret.start();
    PaceCaret.handleSpace(false, "hi ");
    vi.advanceTimersByTime(200);
    expect(positions()).toEqual(["0:1", "0:2"]);
  });

  it("hides and stops once it runs out of words", async () => {
    await PaceCaret.init();
    PaceCaret.start();
    vi.advanceTimersByTime(200 * 20);
    expect(positions().at(-1)).toBe("3:0");
    expect(mocks.hidden).toBe(true);
    const calls = mocks.goTo.length;
    vi.advanceTimersByTime(2000);
    expect(mocks.goTo).toHaveLength(calls);
  });

  it("stops moving after a reset and while the result is visible", async () => {
    await PaceCaret.init();
    PaceCaret.start();
    vi.advanceTimersByTime(200);
    PaceCaret.reset();
    vi.advanceTimersByTime(1000);
    expect(positions()).toEqual(["0:1", "0:2"]);

    await PaceCaret.init();
    PaceCaret.start();
    mocks.resultVisible = true;
    vi.advanceTimersByTime(1000);
    expect(positions()).toEqual(["0:1", "0:2", "0:1"]);
  });

  it("does not move when the test is inactive", async () => {
    mocks.active = false;
    await PaceCaret.init();
    PaceCaret.start();
    expect(positions()).toEqual([]);
  });

  it("disables itself for speeds below one", async () => {
    getMutableConfig().paceCaretCustomSpeed = 0.5;
    await PaceCaret.init();
    expect(mocks.paceWpm).toBeUndefined();
    PaceCaret.start();
    expect(positions()).toEqual([]);
  });

  it("uses the local personal best", async () => {
    getMutableConfig().paceCaret = "pb";
    mocks.localPb = { wpm: 120 };
    await PaceCaret.init();
    expect(mocks.paceWpm).toBe(120);
  });

  it("keeps the last test speed, or the fastest one while repeating", async () => {
    getMutableConfig().paceCaret = "last";
    PaceCaret.setLastTestWpm(70);
    await PaceCaret.init();
    expect(mocks.paceWpm).toBe(70);

    PaceCaret.setLastTestWpm(50);
    await PaceCaret.init();
    expect(mocks.paceWpm).toBe(50);

    mocks.paceRepeat = true;
    PaceCaret.setLastTestWpm(40);
    await PaceCaret.init();
    expect(mocks.paceWpm).toBe(50);
    PaceCaret.setLastTestWpm(90);
    await PaceCaret.init();
    expect(mocks.paceWpm).toBe(90);
  });

  it("returns to the first letter without animating on reset", () => {
    PaceCaret.resetCaretPosition();
    expect(mocks.hidden).toBe(true);
    expect(mocks.goTo).toEqual([
      expect.objectContaining({ wordIndex: 0, letterIndex: 0, animate: false }),
    ]);
  });
});
