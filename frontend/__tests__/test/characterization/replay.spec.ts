import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import type { EventLog } from "@oxytype/typing-core/events/types";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";

// Characterizes the result-screen replay built from the recorded event log.

const sounds = vi.hoisted(() => ({ click: vi.fn(), error: vi.fn() }));
vi.mock("../../../src/ts/controllers/sound-controller", () => ({
  playClick: sounds.click,
  playError: sounds.error,
}));

import { getMutableConfig } from "../../../src/ts/config/store";
import { getDefaultConfig } from "../../../src/ts/constants/default-config";
import { resultState, setResultState } from "../../../src/ts/states/result";
import {
  logTestEvent,
  resetTestEvents,
} from "../../../src/ts/test/events/data";
import * as Replay from "../../../src/ts/test/replay";
import * as TestWords from "../../../src/ts/test/test-words";

const fixture = JSON.parse(
  readFileSync(
    resolve(
      fileURLToPath(import.meta.url),
      "../../../../../packages/typing-core/__fixtures__/keystrokes/words-10-errors.json",
    ),
    "utf-8",
  ),
) as { eventLog: EventLog };

const START = 10_000;

function load(words: string[], events: EventLog["events"]): void {
  TestWords.words.reset();
  for (const word of words) TestWords.words.push(word, 0);
  resetTestEvents();
  for (const event of events) {
    logTestEvent(event.type, START + event.testMs, event.data);
  }
}

function render(): string[] {
  return resultState.replay.words.map(
    (word) =>
      (word.error ? "!" : "") +
      word.letters
        .map((letter) =>
          letter.extra
            ? `+${letter.char}`
            : letter.correct
              ? letter.char.toUpperCase()
              : letter.incorrect
                ? `x${letter.char}`
                : letter.char,
        )
        .join(""),
  );
}

const start = {
  type: "timer",
  testMs: 0,
  data: { event: "start", timer: 0, date: 0 },
} as const;
function insert(
  testMs: number,
  wordIndex: number,
  inputValue: string,
  correct = true,
  commitsWord?: true,
): EventLog["events"][number] {
  return {
    type: "input",
    testMs,
    data: {
      inputType: "insertText",
      data: inputValue.at(-1) ?? "",
      correct,
      wordIndex,
      charIndex: inputValue.length - 1,
      inputValue,
      commitsWord,
    },
  };
}
function remove(
  testMs: number,
  wordIndex: number,
  inputValue: string,
): EventLog["events"][number] {
  return {
    type: "input",
    testMs,
    data: {
      inputType: "deleteContentBackward",
      wordIndex,
      charIndex: inputValue.length + 1,
      inputValue,
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  vi.clearAllMocks();
  Object.assign(getMutableConfig(), getDefaultConfig(), {
    mode: "words",
    words: 3,
  });
  setResultState("replay", {
    visible: false,
    slideDuration: 0,
    playback: "start",
    stats: "0s",
    words: [],
  });
});
afterEach(() => {
  Replay.pauseReplay();
  vi.useRealTimers();
});

describe("replay", () => {
  it("plays a recorded test back to its final state", () => {
    load(fixture.eventLog.context.targetWords, fixture.eventLog.events);
    Replay.toggleReplayDisplay();
    expect(resultState.replay.visible).toBe(true);
    expect(resultState.replay.slideDuration).toBe(250);
    expect(render()).toMatchInlineSnapshot(`
      [
        "all ",
        "man ",
        "would ",
        "school ",
        "where ",
        "day ",
        "do ",
        "never ",
        "well ",
        "against",
      ]
    `);
    expect(resultState.replay.stats).toBe("0wpm\t0s");

    getMutableConfig().playSoundOnError = "1";
    Replay.togglePlayback();
    expect(resultState.replay.playback).toBe("playing");
    vi.runAllTimers();
    expect(resultState.replay.playback).toBe("start");
    expect(render()).toMatchSnapshot();
    expect(resultState.replay.stats).toMatchSnapshot();
    expect(sounds.error.mock.calls.length).toMatchInlineSnapshot(`6`);
    expect(sounds.click.mock.calls.length).toMatchInlineSnapshot(`64`);
  });

  it("shows only the words reached by the end of the test", () => {
    load(
      ["hi ", "you ", "all"],
      [start, insert(100, 0, "h"), insert(200, 0, "hi")],
    );
    Replay.toggleReplayDisplay();
    expect(render()).toMatchInlineSnapshot(`
      [
        "hi ",
      ]
    `);
  });

  it("marks letters, extra letters, word errors and backspaces", () => {
    load(
      ["hi ", "you ", "all"],
      [
        start,
        insert(100, 0, "h"),
        insert(200, 0, "hx", false),
        insert(300, 0, "hxz", false),
        insert(400, 0, "hxz ", false, true),
        insert(500, 1, "y"),
        remove(600, 1, ""),
        insert(700, 1, "y"),
        insert(800, 1, "yo"),
      ],
    );
    Replay.toggleReplayDisplay();
    Replay.togglePlayback();
    vi.advanceTimersByTime(450);
    expect(render()).toMatchInlineSnapshot(`
      [
        "!Hxix + ",
        "You ",
      ]
    `);
    vi.advanceTimersByTime(100);
    expect(render()).toMatchInlineSnapshot(`
      [
        "!Hxix + ",
        "you ",
      ]
    `);
    vi.advanceTimersByTime(100);
    expect(render()).toMatchInlineSnapshot(`
      [
        "!Hxix + ",
        "You ",
      ]
    `);
    vi.runAllTimers();
    expect(render()).toMatchInlineSnapshot(`
      [
        "!Hxix + ",
        "YOu ",
      ]
    `);
  });

  it("restores the previous word when backspacing into it", () => {
    load(
      ["hi ", "you ", "all"],
      [
        start,
        insert(100, 0, "h"),
        insert(200, 0, "hx", false),
        insert(300, 0, "hx ", false, true),
        remove(400, 0, "hx"),
        remove(500, 0, "h"),
        insert(600, 0, "hi"),
      ],
    );
    Replay.toggleReplayDisplay();
    Replay.togglePlayback();
    vi.advanceTimersByTime(350);
    expect(render()).toMatchInlineSnapshot(`
      [
        "Hxi ",
      ]
    `);
    vi.advanceTimersByTime(100);
    expect(render()).toMatchInlineSnapshot(`
      [
        "Hi ",
      ]
    `);
    vi.runAllTimers();
    expect(render()).toMatchInlineSnapshot(`
      [
        "HI ",
      ]
    `);
  });

  it("pauses, resumes and jumps to a letter", () => {
    load(
      ["hi ", "you ", "all"],
      [
        start,
        insert(100, 0, "h"),
        insert(1200, 0, "hi"),
        insert(1300, 0, "hi ", true, true),
        insert(2400, 1, "y"),
        insert(2500, 1, "yo"),
      ],
    );
    Replay.toggleReplayDisplay();
    Replay.togglePlayback();
    vi.advanceTimersByTime(1250);
    Replay.togglePlayback();
    expect(resultState.replay.playback).toBe("paused");
    expect(render()).toMatchInlineSnapshot(`
      [
        "HI ",
        "you ",
      ]
    `);
    vi.advanceTimersByTime(5000);
    expect(render()).toMatchInlineSnapshot(`
      [
        "HI ",
        "you ",
      ]
    `);

    Replay.togglePlayback();
    expect(resultState.replay.playback).toBe("playing");
    vi.runAllTimers();
    expect(render()).toMatchInlineSnapshot(`
      [
        "HI ",
        "YOu ",
      ]
    `);

    Replay.jumpToLetter(1, 1);
    expect(resultState.replay.playback).toBe("paused");
    expect(render()).toMatchInlineSnapshot(`
      [
        "HI ",
        "You ",
      ]
    `);
    expect(resultState.replay.stats).toBe("0wpm\t2s");
  });

  it("hides the replay and pauses playback when toggled off", () => {
    load(
      ["hi ", "you ", "all"],
      [start, insert(100, 0, "h"), insert(1200, 0, "hi")],
    );
    Replay.toggleReplayDisplay();
    Replay.togglePlayback();
    Replay.toggleReplayDisplay();
    expect(resultState.replay.visible).toBe(false);
    expect(resultState.replay.playback).toBe("paused");
  });

  it("replays zen mode against what was typed", () => {
    getMutableConfig().mode = "zen";
    load(
      [],
      [
        start,
        insert(100, 0, "o"),
        insert(200, 0, "o", false),
        insert(300, 0, "ok"),
        insert(400, 0, "ok ", true, true),
        insert(500, 1, "n"),
      ],
    );
    Replay.toggleReplayDisplay();
    Replay.togglePlayback();
    vi.runAllTimers();
    expect(render()).toMatchSnapshot();
  });
});
