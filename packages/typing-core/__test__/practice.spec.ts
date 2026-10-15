import { describe, it, expect } from "vite-plus/test";
import { buildPracticeWords } from "../src/practise-words";
import { createWeakSpot } from "../src/weak-spot";
import {
  createPaceState,
  advancePace,
  correctPace,
  PaceTracker,
} from "../src/pace-caret";
import { EventLog } from "../src/events/types";
import { loadParityCases } from "./fixtures";
import { Wordset } from "../src/wordset";

const errors = loadParityCases().find((c) => c.name === "words-10-errors")
  ?.fixture.eventLog as EventLog;
describe("practice selection", () => {
  it("weights missed words and preserves preceding words for biword practice", () => {
    const words = errors.context.targetWords.map((word) =>
      word.replace(/[ \n]$/, ""),
    );
    const missed = buildPracticeWords(errors, words, "words", false);
    expect(missed?.text).toEqual(["school", "school", "school", "man", "do"]);
    expect(missed?.sectionLimit).toBe(15);
    const biwords = buildPracticeWords(errors, words, "biwords", false);
    expect(biwords?.text).toContain("would school");
    expect(biwords?.sectionLimit).toBe(15);
  });
  it("selects the slowest 20% of completed words", () => {
    const words = errors.context.targetWords.map((word) =>
      word.replace(/[ \n]$/, ""),
    );
    const slow = buildPracticeWords(errors, words, "off", true);
    expect(slow?.text.length).toBe(3);
    expect(slow?.sectionLimit).toBe(10);
  });
  it("keeps weak-spot learning isolated and penalizes errors", () => {
    const learner = createWeakSpot();
    learner.updateScore("x", false, 100);
    let sample = 0;
    const words = new Wordset(["x", "a"]);
    words.randomWord = () => (sample++ % 2 ? "x" : "a");
    expect(learner.getWord(words)).toBe("x");
    sample = 0;
    expect(createWeakSpot().getWord(words)).toBe("a");
  });
});

describe("pace math", () => {
  it("advances across words and corrects each mistake once", () => {
    const state = createPaceState(120);
    if (!state) throw new Error("No pace state");
    expect(state.spc).toBe(0.1);
    const words = ["abc", "def", "ghi"];
    const getWord = (index: number): string | undefined => words[index];
    correctPace(state, 0, false, "abc ", false);
    correctPace(state, 0, false, "abc ", false);
    expect(state.correction).toBe(4);
    expect(advancePace(state, getWord, false)).toBe(true);
    expect([state.currentWordIndex, state.currentLetterIndex]).toEqual([1, 1]);
    correctPace(state, 0, true, "abc ", false);
    expect(advancePace(state, getWord, false)).toBe(true);
    expect([state.currentWordIndex, state.currentLetterIndex]).toEqual([0, 2]);
  });
  it("ignores corrections in blind mode and handles invalid speed", () => {
    expect(createPaceState(0)).toBeNull();
    expect(createPaceState(Infinity)).toBeNull();
    const state = createPaceState(60);
    if (!state) throw new Error("No pace state");
    correctPace(state, 0, false, "abc ", true);
    expect(state.correction).toBe(0);
    expect(advancePace(state, () => undefined, true)).toBe(false);
  });
});

describe("pace tracker", () => {
  const words = ["hi ", "you ", "all"];
  const getWord = (index: number): string | undefined =>
    words[index]?.trimEnd();

  it("steps one letter at a time anchored to the start", () => {
    const pace = new PaceTracker();
    expect(pace.reset(60)).toBe(true);
    pace.start(1000);
    expect(pace.step(getWord, false)).toEqual({
      wordIndex: 0,
      letterIndex: 1,
      wpm: 60,
    });
    expect(pace.getStepEnd()).toBe(1200);
    pace.step(getWord, false);
    pace.step(getWord, false);
    expect(pace.getPosition()).toMatchObject({ wordIndex: 1, letterIndex: 0 });
    expect(pace.getStepEnd()).toBe(1600);
  });

  it("catches up every due step and stops when out of words", () => {
    const pace = new PaceTracker();
    pace.reset(60);
    pace.start(0);
    expect(pace.advanceTo(199, getWord, false)).toMatchObject({
      wordIndex: 0,
      letterIndex: 0,
    });
    expect(pace.advanceTo(1200, getWord, false)).toMatchObject({
      wordIndex: 1,
      letterIndex: 3,
    });
    expect(pace.advanceTo(5000, getWord, false)).toBeNull();
    expect(pace.isEnabled()).toBe(false);
  });

  it("applies word corrections and disables slow speeds", () => {
    const pace = new PaceTracker();
    pace.reset(60);
    pace.start(0);
    pace.correct(0, false, "hi ", false);
    expect(pace.step(getWord, false)).toMatchObject({
      wordIndex: 1,
      letterIndex: 1,
    });
    expect(pace.reset(0.5)).toBe(false);
    expect(pace.step(getWord, false)).toBeNull();
    expect(pace.reset()).toBe(false);
  });

  it("remembers the last speed, keeping the fastest while repeating", () => {
    const pace = new PaceTracker();
    pace.rememberWpm(70, false);
    pace.rememberWpm(50, false);
    expect(pace.getLastWpm()).toBe(50);
    pace.rememberWpm(40, true);
    expect(pace.getLastWpm()).toBe(50);
    pace.rememberWpm(90, true);
    expect(pace.getLastWpm()).toBe(90);
    pace.reset(60);
    expect(pace.getLastWpm()).toBe(90);
  });
});
