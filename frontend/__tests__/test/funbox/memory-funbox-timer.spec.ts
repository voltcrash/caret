import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

import {
  isWordsWrapperVisible,
  setWordsWrapperVisible,
} from "../../../src/ts/states/funbox";
import {
  getMemoryTimerText,
  getMemoryTimerVisibility,
} from "../../../src/ts/states/funbox-timers";
import * as MemoryTimer from "../../../src/features/typing/runtime/funbox/memory-funbox-timer";

beforeEach(() => {
  vi.useFakeTimers();
  MemoryTimer.reset();
  setWordsWrapperVisible(true);
});

afterEach(() => {
  MemoryTimer.reset();
  vi.useRealTimers();
});

describe("memory funbox timer", () => {
  it("shows the memorisation countdown and hides words when time expires", () => {
    MemoryTimer.start(3);

    expect(getMemoryTimerVisibility()).toBe("shown");
    expect(getMemoryTimerText()).toBe("Timer left to memorise all words: 3s");
    expect(isWordsWrapperVisible()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(getMemoryTimerText()).toBe("Timer left to memorise all words: 2s");
    expect(isWordsWrapperVisible()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(getMemoryTimerText()).toBe("Timer left to memorise all words: 1s");
    expect(getMemoryTimerVisibility()).toBe("shown");

    vi.advanceTimersByTime(1000);
    expect(getMemoryTimerVisibility()).toBe("hidden");
    expect(isWordsWrapperVisible()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resets safely without hiding words later", () => {
    MemoryTimer.start(3);
    vi.advanceTimersByTime(1000);

    MemoryTimer.reset();
    MemoryTimer.reset();
    expect(getMemoryTimerVisibility()).toBe("hidden");
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(10000);
    expect(getMemoryTimerText()).toBe("Timer left to memorise all words: 2s");
    expect(isWordsWrapperVisible()).toBe(true);
  });

  it("replaces the previous interval when a new countdown starts", () => {
    MemoryTimer.start(3);
    vi.advanceTimersByTime(1000);

    MemoryTimer.start(5);
    expect(getMemoryTimerText()).toBe("Timer left to memorise all words: 5s");
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(2000);
    expect(getMemoryTimerText()).toBe("Timer left to memorise all words: 3s");
    expect(getMemoryTimerVisibility()).toBe("shown");
    expect(isWordsWrapperVisible()).toBe(true);

    vi.advanceTimersByTime(3000);
    expect(getMemoryTimerVisibility()).toBe("hidden");
    expect(isWordsWrapperVisible()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
