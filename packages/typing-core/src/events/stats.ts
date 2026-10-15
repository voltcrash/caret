import {
  getTargetWord,
  countCharsForWordIndex,
  inferActiveWordIndex,
} from "./stats/characters";
import {
  getTimerBoundaryLabels,
  getTimerBoundaries,
  getLaggedTimerBoundaries,
} from "./stats/timing";
import { calculateWpm } from "../stats-math";
import { EventLog, TestEventNoMs } from "./types";

export function getWpmHistory(eventLog: EventLog): number[] {
  const { events } = eventLog;
  const boundaries = getTimerBoundaries(eventLog);
  if (boundaries.length === 0) return [];

  const eventsPerWord = new Map<number, TestEventNoMs[]>();
  const cachedIfLast = new Map<number, number>();
  const cachedIfNotLast = new Map<number, number>();
  const dirty = new Set<number>();
  const wpmHistory: number[] = [];

  let eventIdx = 0;

  for (const boundary of boundaries) {
    // incrementally extend eventsPerWord with events up to this boundary
    while (eventIdx < events.length) {
      const event = events[eventIdx];
      if (event === undefined || event.testMs > boundary) break;

      if ("wordIndex" in event.data) {
        const wordIndex = event.data.wordIndex;
        let list = eventsPerWord.get(wordIndex);
        if (list === undefined) {
          list = [];
          eventsPerWord.set(wordIndex, list);
        }
        list.push(event);
        dirty.add(wordIndex);
      }
      eventIdx++;
    }

    // recompute correctWord (for both last/not-last roles) only for words
    // whose event lists changed since the previous boundary
    for (const wordIndex of dirty) {
      const wordEvents = eventsPerWord.get(wordIndex);
      if (wordEvents === undefined) continue;
      cachedIfNotLast.set(
        wordIndex,
        countCharsForWordIndex(eventLog, wordIndex, wordEvents, false, true)
          .correctWord,
      );
      cachedIfLast.set(
        wordIndex,
        countCharsForWordIndex(eventLog, wordIndex, wordEvents, true, true)
          .correctWord,
      );
    }
    dirty.clear();

    const lastWordIndex = inferActiveWordIndex(eventsPerWord);

    let correctWord = 0;
    for (const wordIndex of eventsPerWord.keys()) {
      if (wordIndex === lastWordIndex) {
        correctWord += cachedIfLast.get(wordIndex) ?? 0;
        break;
      }
      correctWord += cachedIfNotLast.get(wordIndex) ?? 0;
    }

    wpmHistory.push(Math.round(calculateWpm(correctWord, boundary / 1000)));
  }

  return wpmHistory;
}

export function getRawHistory(eventLog: EventLog): number[] {
  const { events } = eventLog;
  const boundaries = getTimerBoundaries(eventLog);
  if (boundaries.length === 0) return [];

  const eventsPerWord = new Map<number, TestEventNoMs[]>();
  const cachedIfLast = new Map<number, number>();
  const cachedIfNotLast = new Map<number, number>();
  const dirty = new Set<number>();
  const rawHistory: number[] = [];

  let eventIdx = 0;

  for (const boundary of boundaries) {
    // incrementally extend eventsPerWord with events up to this boundary
    while (eventIdx < events.length) {
      const event = events[eventIdx];
      if (event === undefined || event.testMs > boundary) break;

      if ("wordIndex" in event.data) {
        const wordIndex = event.data.wordIndex;
        let list = eventsPerWord.get(wordIndex);
        if (list === undefined) {
          list = [];
          eventsPerWord.set(wordIndex, list);
        }
        list.push(event);
        dirty.add(wordIndex);
      }
      eventIdx++;
    }

    // recompute correctWord (for both last/not-last roles) only for words
    // whose event lists changed since the previous boundary
    for (const wordIndex of dirty) {
      const wordEvents = eventsPerWord.get(wordIndex);
      if (wordEvents === undefined) continue;

      const notLastCount = countCharsForWordIndex(
        eventLog,
        wordIndex,
        wordEvents,
        false,
        true,
      );
      const lastCount = countCharsForWordIndex(
        eventLog,
        wordIndex,
        wordEvents,
        true,
        true,
      );

      cachedIfNotLast.set(
        wordIndex,
        notLastCount.allCorrect + notLastCount.extra + notLastCount.incorrect,
      );
      cachedIfLast.set(
        wordIndex,
        lastCount.allCorrect + lastCount.extra + lastCount.incorrect,
      );
    }
    dirty.clear();

    const lastWordIndex = inferActiveWordIndex(eventsPerWord);

    let chars = 0;
    for (const wordIndex of eventsPerWord.keys()) {
      if (wordIndex === lastWordIndex) {
        chars += cachedIfLast.get(wordIndex) ?? 0;
        break;
      }
      chars += cachedIfNotLast.get(wordIndex) ?? 0;
    }

    rawHistory.push(Math.round(calculateWpm(chars, boundary / 1000)));
  }

  return rawHistory;
}

export const __testing = {
  getTimerBoundaries,
  getLaggedTimerBoundaries,
  getTimerBoundaryLabels,
  getTargetWord,
  inferActiveWordIndex,
};

export {
  getTimerBoundaryLabels,
  getStartToFirstKeypressMs,
  getLastKeypressToEndMs,
  getTestDurationMs,
  getDateBasedTestDurationMs,
} from "./stats/timing";

export { getWordBurst, getWordBurstHistory } from "./stats/bursts";

export {
  getKeypressSpacing,
  getKeypressOverlap,
  getKeypressDurations,
} from "./stats/key-timing";

export { getChars, getAccuracy } from "./stats/characters";

export {
  getInputHistory,
  getMissedWords,
  getCorrectedWordsHistory,
} from "./stats/word-history";

export {
  getKeypressesPerSecond,
  getBurstHistory,
  getWordIndexesForSecond,
  getErrorCountHistory,
  getAfkDuration,
  getIncompleteTestSeconds,
} from "./stats/intervals";
