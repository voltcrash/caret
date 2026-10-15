import { isTimedTest } from "./timing";
import { CharCounts, countChars, isSpace } from "../../strings";
import { getEventsPerWord, getInputFromDom } from "../helpers";
import { EventLog, TestEventNoMs } from "../types";
import Hangul from "hangul-js";

export function getTargetWord(
  eventLog: EventLog,
  wordIndex: number,
): string | undefined {
  return eventLog.context.targetWords[wordIndex];
}
export function countCharsForWordIndex(
  eventLog: EventLog,
  wordIndex: number,
  wordEvents: TestEventNoMs[],
  lastWord: boolean,
  countPartial: boolean,
): CharCounts {
  let simulatedInput = getInputFromDom(wordEvents);
  // IME commit chars (e.g. the full-width ideographic space U+3000) differ from
  // the regular space the target word uses as a separator. Normalize them so
  // the comparison matches the live input path, which treats them via isSpace.
  // Preserve the existing code-point normalization for IME spaces.
  simulatedInput = Array.from(simulatedInput)
    .map((c) => (isSpace(c) ? " " : c))
    .join("");
  if (eventLog.context.koreanStatus) {
    simulatedInput = Hangul.disassemble(simulatedInput).join("");
  }

  let targetWord = getTargetWord(eventLog, wordIndex) ?? simulatedInput;
  if (eventLog.context.koreanStatus) {
    targetWord = Hangul.disassemble(targetWord).join("");
  }

  return countChars(simulatedInput, targetWord, lastWord && countPartial);
}
export function inferActiveWordIndex(
  eventsPerWord: Map<number, TestEventNoMs[]>,
): number {
  let maxWordIndex = -1;
  let lastWordEvents: TestEventNoMs[] | undefined;
  for (const [k, wordEvents] of eventsPerWord) {
    if (getInputFromDom(wordEvents).length > 0 && k > maxWordIndex) {
      maxWordIndex = k;
      lastWordEvents = wordEvents;
    }
  }
  if (lastWordEvents === undefined) return 0;
  const lastEvt = lastWordEvents[lastWordEvents.length - 1];
  // committed trailing space → cursor advanced to the next word
  if (
    lastEvt !== undefined &&
    "inputType" in lastEvt.data &&
    lastEvt.data.inputType === "insertText" &&
    lastEvt.data.data === " "
  ) {
    return maxWordIndex + 1;
  }
  return maxWordIndex;
}
export function getChars(
  eventLog: EventLog,
  countPartialLastWord = false,
  testMs?: number,
): CharCounts {
  const { events, context } = eventLog;
  const { bailedOut } = context;

  const isTimed = isTimedTest(eventLog);

  const eventsPerWord = getEventsPerWord(events, testMs);
  const lastWordIndex = inferActiveWordIndex(eventsPerWord);

  const countPartial = isTimed || bailedOut || countPartialLastWord;

  const acc: CharCounts = {
    allCorrect: 0,
    correctWord: 0,
    incorrect: 0,
    extra: 0,
    missed: 0,
  };

  for (const [wordIndex, wordEvents] of eventsPerWord) {
    const lastWord = wordIndex === lastWordIndex;
    const c = countCharsForWordIndex(
      eventLog,
      wordIndex,
      wordEvents,
      lastWord,
      countPartial,
    );
    acc.allCorrect += c.allCorrect;
    acc.correctWord += c.correctWord;
    acc.incorrect += c.incorrect;
    acc.extra += c.extra;
    acc.missed += c.missed;

    if (lastWord) break;
  }

  return acc;
}
export function getAccuracy(
  eventLog: EventLog,
  testMs?: number,
): {
  correct: number;
  incorrect: number;
  percentage: number;
} {
  const { events } = eventLog;

  let correct = 0;
  let incorrect = 0;

  for (const event of events) {
    if (testMs !== undefined && event.testMs > testMs) break;
    if (event.type !== "input") continue;

    if (!("correct" in event.data)) {
      continue;
    }
    if (event.data.correct) {
      correct++;
    } else {
      incorrect++;
    }
  }
  const total = correct + incorrect;
  const percentage = total === 0 ? 0 : (correct / total) * 100;

  return {
    correct: correct,
    incorrect: incorrect,
    percentage: percentage,
  };
}
