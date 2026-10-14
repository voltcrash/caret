import { describe, expect, it } from "vite-plus/test";
import {
  applyReplayStep,
  createReplayPrompt,
  getReplaySteps,
  getReplayWords,
  replayDuration,
  replayFrame,
  ReplayWord,
  seekReplay,
} from "../src/replay";
import type { EventLog } from "../src/events/types";
import { getInputHistory } from "../src/events/stats";
import { loadParityCases } from "./fixtures";

describe("input snapshot replay", () => {
  for (const { name, fixture } of loadParityCases()) {
    it(`reconstructs the final recorded inputs: ${name}`, () => {
      const log = fixture.eventLog as EventLog;
      const expected = getInputHistory(log);
      const frame = replayFrame(log, replayDuration(log));
      expect(
        Array.from(
          { length: expected.length },
          (_, i) => frame.inputs[i] ?? "",
        ),
      ).toEqual(expected);
      expect(replayFrame(log, -1).inputs).toEqual([]);
    });
  }
  it("seeks backwards and includes automatic corrections and word regression", () => {
    const log: EventLog = {
      version: 1,
      context: {
        targetWords: ["cat ", "dog"],
        mode: "words",
        mode2: "2",
        bailedOut: false,
        koreanStatus: false,
      },
      events: [
        {
          type: "input",
          testMs: 0,
          data: {
            inputType: "insertText",
            data: " ",
            wordIndex: 0,
            charIndex: 3,
            inputValue: "cox ",
            correct: false,
            commitsWord: true,
          },
        },
        {
          type: "input",
          testMs: 100,
          data: {
            inputType: "insertText",
            data: "x",
            wordIndex: 1,
            charIndex: 0,
            inputValue: "x",
            correct: false,
          },
        },
        {
          type: "input",
          testMs: 200,
          data: {
            inputType: "deleteWordBackward",
            wordIndex: 0,
            charIndex: 3,
            inputValue: "cox",
            clearedNextWord: true,
          },
        },
        {
          type: "input",
          testMs: 300,
          data: {
            inputType: "deleteContentBackward",
            wordIndex: 0,
            charIndex: 2,
            inputValue: "co",
            automatic: true,
          },
        },
        {
          type: "input",
          testMs: 400,
          data: {
            inputType: "insertText",
            data: "x",
            wordIndex: 0,
            charIndex: 2,
            inputValue: "co",
            correct: false,
            inputStopped: true,
          },
        },
      ],
    };
    expect(replayFrame(log, 150)).toEqual({
      inputs: ["cox ", "x"],
      activeIndex: 1,
    });
    expect(replayFrame(log, 250)).toEqual({
      inputs: ["cox", ""],
      activeIndex: 0,
    });
    expect(replayFrame(log, 500)).toEqual({
      inputs: ["co", ""],
      activeIndex: 0,
    });
    expect(replayFrame(log, 50)).toEqual({ inputs: ["cox "], activeIndex: 1 });
  });
});

function letters(words: ReplayWord[]): string[] {
  return words.map(
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

describe("letter replay", () => {
  const log: EventLog = {
    version: 1,
    context: {
      targetWords: ["hi ", "you ", "all"],
      mode: "words",
      mode2: "3",
      bailedOut: false,
      koreanStatus: false,
    },
    events: [
      ["h", 0, "h", true],
      ["x", 0, "hx", false],
      [" ", 0, "hx ", false, true],
      ["y", 1, "y", true],
    ].map(([data, wordIndex, inputValue, correct, commitsWord], i) => ({
      type: "input" as const,
      testMs: (i + 1) * 100,
      data: {
        inputType: "insertText" as const,
        data: data as string,
        wordIndex: wordIndex as number,
        charIndex: (inputValue as string).length - 1,
        inputValue: inputValue as string,
        correct: correct as boolean,
        commitsWord: commitsWord as true | undefined,
      },
    })),
  };
  log.events.push(
    {
      type: "input",
      testMs: 500,
      data: {
        inputType: "deleteContentBackward",
        wordIndex: 1,
        charIndex: 1,
        inputValue: "",
      },
    },
    {
      type: "input",
      testMs: 600,
      data: {
        inputType: "deleteContentBackward",
        wordIndex: 0,
        charIndex: 3,
        inputValue: "hx",
      },
    },
  );

  it("derives letter steps, word submits and regressions", () => {
    expect(getReplaySteps(log, false)).toEqual([
      { action: "correctLetter", value: "h", time: 100 },
      { action: "incorrectLetter", value: "x", time: 200 },
      { action: "incorrectLetter", value: " ", time: 300 },
      { action: "submitErrorWord", time: 400 },
      { action: "correctLetter", value: "y", time: 400 },
      { action: "setLetterIndex", value: 0, time: 500 },
      { action: "backWord", time: 600 },
    ]);
    expect(getReplayWords(log, false)).toEqual(["hi ", "you ", "all"]);
  });

  it("judges zen words against what was typed", () => {
    const steps = getReplaySteps(log, true);
    expect(steps[3]).toEqual({ action: "submitCorrectWord", time: 400 });
    expect(getReplayWords(log, true)).toEqual(["hx", ""]);
  });

  it("applies steps to the prompt and reports their sounds", () => {
    const steps = getReplaySteps(log, false);
    const words = createReplayPrompt(getReplayWords(log, false), steps);
    expect(letters(words)).toEqual(["hi "]);
    const all = createReplayPrompt(
      ["hi ", "you "],
      [{ action: "submitCorrectWord", time: 0 }],
    );
    const cursor = { wordIndex: 0, letterIndex: 0 };
    const sounds = steps.map((step) => applyReplayStep(all, cursor, step));
    expect(sounds).toEqual([
      "click",
      "error",
      "error",
      "error",
      "click",
      "click",
      "click",
    ]);
    expect(letters(all)).toEqual(["Hxix ", "you "]);
    expect(cursor).toEqual({ wordIndex: 0, letterIndex: 3 });
  });

  it("adds extra letters past the end of a word", () => {
    const words = createReplayPrompt(["a"], []);
    const cursor = { wordIndex: 0, letterIndex: 1 };
    applyReplayStep(words, cursor, {
      action: "incorrectLetter",
      value: "z",
      time: 0,
    });
    expect(letters(words)).toEqual(["a+z"]);
    applyReplayStep(words, cursor, {
      action: "setLetterIndex",
      value: 0,
      time: 0,
    });
    expect(letters(words)).toEqual(["a"]);
  });

  it("seeks silently to a letter", () => {
    const steps = getReplaySteps(log, false);
    const words = createReplayPrompt(
      ["hi ", "you "],
      [{ action: "submitCorrectWord", time: 0 }],
    );
    expect(seekReplay(words, steps, { wordIndex: 1, letterIndex: 1 })).toEqual({
      cursor: { wordIndex: 1, letterIndex: 1 },
      nextIndex: 5,
    });
    expect(letters(words)).toEqual(["!Hxix ", "You "]);
  });
});
