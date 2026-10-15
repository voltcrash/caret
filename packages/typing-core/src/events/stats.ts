import {
  getTargetWord,
  countCharsForWordIndex,
  inferActiveWordIndex,
} from "./stats/characters";
import {
  getTimerBoundaryLabels,
  getTimerBoundaries,
  getLaggedTimerBoundaries,
  getTestDurationMs,
} from "./stats/timing";
import { getEventsPerWord, getInputFromDom } from "./helpers";
import { calculateWpm } from "../stats-math";
import { roundTo2 } from "@oxytype/util/numbers";
import { EventLog, TestEventNoMs } from "./types";

function countPerInterval(
  eventLog: EventLog,
  predicate: (event: TestEventNoMs) => boolean,
): {
  counts: number[];
  boundaries: number[];
} {
  const { events } = eventLog;
  const boundaries = getTimerBoundaries(eventLog);

  const counts: number[] = [];
  let eventIndex = 0;

  for (const boundary of boundaries) {
    let count = 0;
    while (eventIndex < events.length) {
      const event = events[eventIndex];
      if (event === undefined) break;
      if (event.testMs > boundary) break;

      if (predicate(event)) {
        count++;
      }
      eventIndex++;
    }
    counts.push(count);
  }

  return { counts, boundaries };
}

export function getKeypressesPerSecond(eventLog: EventLog): number[] {
  const { counts } = countPerInterval(
    eventLog,
    (e) => e.type === "input" && e.data.inputType === "insertText",
  );

  return counts;
}

export function getBurstHistory(eventLog: EventLog): number[] {
  const { counts, boundaries } = countPerInterval(
    eventLog,
    (e) => e.type === "input" && e.data.inputType === "insertText",
  );

  let prevBoundary = 0;
  return counts.map((kps, i) => {
    const boundary = boundaries[i] as number;
    const intervalSeconds = (boundary - prevBoundary) / 1000;
    prevBoundary = boundary;
    return Math.round(calculateWpm(kps, intervalSeconds));
  });
}

export function getInputHistory(eventLog: EventLog): string[] {
  const eventsPerWordIndex = getEventsPerWord(eventLog.events);
  const history: string[] = [];

  for (const [wordIndex, events] of eventsPerWordIndex) {
    const lastEvent = events[events.length - 1];
    if (lastEvent === undefined) {
      history.push("");
      continue;
    }

    // THANKS FIREFOX FOR THIS MESS
    // A word is abandoned if the regression destination event — which
    // lives in the previous word's bucket — carries clearedNextWord.
    // Happens when Ctrl+Backspace eats the sentinel + non-word residue as
    // one run; the residue stays as this word's last inputValue but its
    // real final state is "".
    const previousWord = eventsPerWordIndex.get(wordIndex - 1) ?? [];
    const abandoned = previousWord.some(
      (e) =>
        e.testMs > lastEvent.testMs &&
        "clearedNextWord" in e.data &&
        e.data.clearedNextWord === true,
    );

    history.push(abandoned ? "" : getInputFromDom(events));
  }

  return history;
}

export function getWordIndexesForSecond(
  eventLog: EventLog,
  second: number,
): number[] {
  const { events } = eventLog;
  const boundaries = getTimerBoundaries(eventLog);

  const boundary = boundaries[second];
  if (boundary === undefined) return [];

  const prevBoundary = second > 0 ? boundaries[second - 1] : undefined;
  const wordIndexes = new Set<number>();

  for (const event of events) {
    if (prevBoundary !== undefined && event.testMs <= prevBoundary) continue;
    if (event.testMs > boundary) break;

    if ("wordIndex" in event.data) {
      wordIndexes.add(event.data.wordIndex);
    }
  }

  return [...wordIndexes];
}

export function getErrorCountHistory(eventLog: EventLog): number[] {
  const { counts } = countPerInterval(
    eventLog,
    (e) =>
      e.type === "input" &&
      e.data.inputType === "insertText" &&
      !e.data.correct,
  );
  return counts;
}

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

export function getAfkDuration(eventLog: EventLog): number {
  const { counts } = countPerInterval(
    eventLog,
    (e) => e.type === "keydown" || e.type === "input",
  );
  return counts.reduce((total, c) => total + (c === 0 ? 1 : 0), 0);
}

// Engaged typing time for an abandoned (restarted) test: real duration minus
// AFK, matching how a finished test is measured (finish path, today-tracker).
// The event log MUST be terminated (contain a timer "end" event) — otherwise
// getAfkDuration has no boundaries and returns 0, letting the full wall-clock
// lifetime (incl. unbounded idle) leak into incompleteTestSeconds.
export function getIncompleteTestSeconds(eventLog: EventLog): number {
  const seconds = roundTo2(
    getTestDurationMs(eventLog) / 1000 - getAfkDuration(eventLog),
  );
  return seconds < 0 ? 0 : seconds;
}

export function getMissedWords(eventLog: EventLog): Record<string, number> {
  const missedWords: Record<string, number> = Object.create(null) as Record<
    string,
    number
  >;

  for (const event of eventLog.events) {
    if (
      event.type === "input" &&
      event.data.inputType === "insertText" &&
      !event.data.correct
    ) {
      const word = eventLog.context.targetWords[event.data.wordIndex];
      if (word === undefined) continue;
      // targetWords store the trailing separator (commit char); strip exactly
      // that one separator (space/newline) to key by the bare word — not
      // trimEnd(), which would also eat a meaningful trailing tab (code mode)
      const bareWord = word.replace(/[ \n]$/, "");
      missedWords[bareWord] = (missedWords[bareWord] ?? 0) + 1;
    }
  }

  return missedWords;
}

export function getCorrectedWordsHistory(eventLog: EventLog): string[] {
  const ev = getEventsPerWord(eventLog.events);
  const correctedWords: string[] = [];

  for (const [, events] of ev.entries()) {
    const correctedChars: string[] = [];
    const currentChars: string[] = [];
    let cursorPos = 0;

    for (const event of events) {
      if (event.type !== "input") continue;
      if (
        event.data.inputType === "insertText" ||
        event.data.inputType === "insertCompositionText"
      ) {
        if (event.data.inputStopped) {
          continue;
        }
        currentChars[cursorPos] = event.data.data;
        cursorPos++;
      } else if (event.data.inputType === "deleteContentBackward") {
        if (cursorPos > 0) {
          cursorPos--;
          correctedChars[cursorPos] = currentChars[cursorPos] ?? "";
        }
      } else if (event.data.inputType === "deleteWordBackward") {
        while (cursorPos > 0) {
          cursorPos--;
          correctedChars[cursorPos] = currentChars[cursorPos] ?? "";
        }
      }
    }

    const result: string[] = [];
    for (let i = 0; i < currentChars.length; i++) {
      result.push(correctedChars[i] ?? currentChars[i] ?? "");
    }
    correctedWords.push(result.join(""));
  }

  return correctedWords;
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
