import { getEventsForWord, getInputFromDom } from "./events/helpers";
import { getInputHistory } from "./events/stats";
import type { EventLog } from "./events/types";

/** Input snapshots include corrections, regressions and automatic deletions. */
export function replayFrame(
  log: EventLog,
  timeMs: number,
): { inputs: string[]; activeIndex: number } {
  const inputs: string[] = [];
  let activeIndex = 0;
  for (const event of log.events) {
    if (event.type !== "input" || event.testMs > timeMs) continue;
    const data = event.data;
    inputs[data.wordIndex] = data.inputValue;
    if ("clearedNextWord" in data && data.clearedNextWord === true) {
      inputs[data.wordIndex + 1] = "";
    }
    activeIndex = data.wordIndex;
    if (
      "commitsWord" in data &&
      data.commitsWord === true &&
      data.lastWord !== true &&
      data.inputStopped !== true
    ) {
      activeIndex++;
    }
  }
  return { inputs, activeIndex };
}

export function replayDuration(log: EventLog): number {
  return log.events.reduce(
    (duration, event) => Math.max(duration, event.testMs),
    0,
  );
}

export type ReplayAction =
  | "correctLetter"
  | "incorrectLetter"
  | "backWord"
  | "submitCorrectWord"
  | "submitErrorWord"
  | "setLetterIndex";
export type ReplayStep = {
  action: ReplayAction;
  value?: string | number;
  time: number;
};
export type ReplayLetter = {
  char: string;
  correct: boolean;
  incorrect: boolean;
  extra: boolean;
};
export type ReplayWord = { letters: ReplayLetter[]; error: boolean };
export type ReplayCursor = { wordIndex: number; letterIndex: number };

/** Words shown by the replay: the targets, or what was typed in zen mode. */
export function getReplayWords(log: EventLog, zen: boolean): string[] {
  return zen ? getInputHistory(log) : [...log.context.targetWords];
}

/** Letter-level playback steps, including word submits and regressions. */
export function getReplaySteps(log: EventLog, zen: boolean): ReplayStep[] {
  const steps: ReplayStep[] = [];
  let prevWordIndex: number | undefined;

  for (const event of log.events) {
    if (event.type !== "input") continue;
    const wi = event.data.wordIndex;

    if (prevWordIndex !== undefined && wi !== prevWordIndex) {
      if (wi > prevWordIndex) {
        const typed = getInputFromDom(
          getEventsForWord(log.events, prevWordIndex),
        );
        const target = zen ? typed : log.context.targetWords[prevWordIndex];
        steps.push({
          action: typed === target ? "submitCorrectWord" : "submitErrorWord",
          time: event.testMs,
        });
      } else {
        steps.push({ action: "backWord", time: event.testMs });
      }
    }

    if (
      event.data.inputType === "insertText" ||
      event.data.inputType === "insertCompositionText"
    ) {
      if (event.data.inputStopped) {
        prevWordIndex = wi;
        continue;
      }
      steps.push({
        action: event.data.correct ? "correctLetter" : "incorrectLetter",
        value: event.data.data,
        time: event.testMs,
      });
    } else if (
      (event.data.inputType === "deleteContentBackward" ||
        event.data.inputType === "deleteWordBackward") &&
      // a regression into the previous word already emitted backWord
      !(prevWordIndex !== undefined && wi < prevWordIndex)
    ) {
      steps.push({
        action: "setLetterIndex",
        value:
          event.data.inputValue !== undefined
            ? event.data.inputValue.length
            : event.data.charIndex,
        time: event.testMs,
      });
    }

    prevWordIndex = wi;
  }

  return steps;
}

/** Untyped letters for every word the test reached. */
export function createReplayPrompt(
  words: string[],
  steps: ReplayStep[],
): ReplayWord[] {
  let wordCount = 0;
  for (const step of steps) {
    if (step.action === "backWord") {
      wordCount--;
    } else if (
      step.action === "submitCorrectWord" ||
      step.action === "submitErrorWord"
    ) {
      wordCount++;
    }
  }
  return words.slice(0, Math.max(0, wordCount + 1)).map((word) => ({
    letters: Array.from(word, (char) => ({
      char,
      correct: false,
      incorrect: false,
      extra: false,
    })),
    error: false,
  }));
}

function isUntouchedLetter(letter: ReplayLetter | undefined): boolean {
  return (
    letter !== undefined &&
    !letter.correct &&
    !letter.incorrect &&
    !letter.extra
  );
}

/** Applies one step in place and returns the sound it should make. */
export function applyReplayStep(
  words: ReplayWord[],
  cursor: ReplayCursor,
  step: ReplayStep,
): "click" | "error" | undefined {
  let activeWord = words[cursor.wordIndex];
  if (activeWord === undefined) return undefined;

  if (step.action === "correctLetter") {
    const letter = activeWord.letters[cursor.letterIndex];
    if (letter !== undefined) letter.correct = true;
    cursor.letterIndex++;
    return "click";
  }
  if (step.action === "incorrectLetter") {
    if (cursor.letterIndex >= activeWord.letters.length) {
      activeWord.letters.push({
        char: step.value?.toString() ?? "",
        correct: false,
        incorrect: false,
        extra: true,
      });
    }
    const letter = activeWord.letters[cursor.letterIndex];
    if (letter !== undefined) letter.incorrect = true;
    cursor.letterIndex++;
    return "error";
  }
  if (step.action === "setLetterIndex") {
    if (typeof step.value !== "number") return undefined;
    cursor.letterIndex = step.value;
    activeWord.letters = [
      ...activeWord.letters.slice(0, cursor.letterIndex),
      ...activeWord.letters
        .slice(cursor.letterIndex)
        .filter((letter) => !letter.extra)
        .map((letter) => ({ ...letter, correct: false, incorrect: false })),
    ];
    return "click";
  }
  if (
    step.action === "submitCorrectWord" ||
    step.action === "submitErrorWord"
  ) {
    if (step.action === "submitErrorWord") activeWord.error = true;
    cursor.wordIndex++;
    cursor.letterIndex = 0;
    return step.action === "submitErrorWord" ? "error" : "click";
  }
  cursor.wordIndex--;
  activeWord = words[cursor.wordIndex];
  if (activeWord === undefined) return "click";
  cursor.letterIndex = activeWord.letters.length;
  while (isUntouchedLetter(activeWord.letters[cursor.letterIndex - 1])) {
    cursor.letterIndex--;
  }
  activeWord.error = false;
  return "click";
}

/** Replays silently up to `target` and returns the index of the next step. */
export function seekReplay(
  words: ReplayWord[],
  steps: ReplayStep[],
  target: ReplayCursor,
): { cursor: ReplayCursor; nextIndex: number } {
  const cursor = { wordIndex: 0, letterIndex: 0 };
  let nextIndex = 0;
  steps.forEach((step, i) => {
    if (
      cursor.wordIndex < target.wordIndex ||
      (cursor.wordIndex === target.wordIndex &&
        cursor.letterIndex < target.letterIndex)
    ) {
      applyReplayStep(words, cursor, step);
      nextIndex = i + 1;
    }
  });
  return { cursor, nextIndex };
}
