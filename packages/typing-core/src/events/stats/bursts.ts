import {
  getEventsForWord,
  getEventsPerWord,
  getInputFromDom,
} from "../helpers";
import { calculateWpm } from "../../stats-math";
import { EventLog, TestEventNoMs } from "../types";

function computeBurst(events: TestEventNoMs[], now?: number): number {
  const inputEvents = events.filter((e) => e.type === "input");
  const input = getInputFromDom(inputEvents);

  let inputLength = input.length;
  if (!input.endsWith(" ") && !input.endsWith("\n")) {
    inputLength += 1; // account for trigger char (space/newline) on word submit
  }

  let firstKeypressTime: number | undefined;
  let lastKeypressTime: number | undefined;

  for (const event of events) {
    if (
      event.type === "composition" &&
      event.data.event === "start" &&
      firstKeypressTime === undefined
    ) {
      firstKeypressTime = event.testMs;
    }

    if (
      event.type === "input" &&
      (event.data.inputType === "insertText" ||
        event.data.inputType === "insertCompositionText")
    ) {
      if (event.data.charIndex === 0 && firstKeypressTime === undefined) {
        firstKeypressTime = event.testMs;
      }
      if (firstKeypressTime !== undefined) {
        lastKeypressTime = event.testMs;
      }
    }
  }

  if (firstKeypressTime === undefined || input.length === 0) {
    return 0;
  }

  if (lastKeypressTime !== undefined && lastKeypressTime < firstKeypressTime) {
    lastKeypressTime = undefined;
  }

  const endTime = lastKeypressTime ?? now ?? performance.now();

  const durationSeconds = (endTime - firstKeypressTime) / 1000;
  if (durationSeconds <= 0) return Infinity;

  return Math.round(calculateWpm(inputLength, durationSeconds));
}
export function getWordBurst(
  eventLog: EventLog,
  wordIndex: number,
  now?: number,
): number {
  const events = getEventsForWord(eventLog.events, wordIndex);
  return computeBurst(events, now);
}
export function getWordBurstHistory(eventLog: EventLog): number[] {
  const eventsPerWord = getEventsPerWord(eventLog.events);
  const burstHistory: number[] = [];
  for (let i = 0; i < eventsPerWord.size; i++) {
    burstHistory.push(computeBurst(eventsPerWord.get(i) ?? []));
  }
  return burstHistory;
}
