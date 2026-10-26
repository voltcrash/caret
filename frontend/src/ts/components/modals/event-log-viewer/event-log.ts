import type { EventLog, TestEventNoMs } from "@caret/web-shared/events/types";

import { EVENT_LOG_VERSION } from "@caret/web-shared/events/types";

export function parseContext(raw: string): EventLog {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Expected an EventLog object");
  }
  if (
    !("version" in parsed) ||
    !("events" in parsed) ||
    !("context" in parsed)
  ) {
    throw new Error(
      `Expected EventLog { version: ${EVENT_LOG_VERSION}, events, context }`,
    );
  }
  if (parsed.version !== EVENT_LOG_VERSION) {
    throw new Error(
      `Unsupported EventLog version ${String(parsed.version)} (expected ${EVENT_LOG_VERSION})`,
    );
  }
  if (!Array.isArray((parsed as EventLog).events)) {
    throw new Error("EventLog.events must be an array");
  }
  const ctx = (parsed as EventLog).context as unknown;
  if (
    typeof ctx !== "object" ||
    ctx === null ||
    !Array.isArray((ctx as { targetWords?: unknown }).targetWords)
  ) {
    throw new Error("EventLog.context.targetWords must be a string array");
  }
  return parsed as EventLog;
}

export function visualizeWhitespace(s: string): string {
  return s.replace(/ /g, "␣").replace(/\t/g, "→").replace(/\n/g, "↵");
}

/** latest testMs in the log, rounded up to a whole millisecond */
export function getMaxTestMs(events: TestEventNoMs[]): number {
  return Math.ceil(events.reduce((m, e) => (e.testMs > m ? e.testMs : m), 0));
}

/**
 * Index of the latest event at or before currentMs. Ties keep the first one,
 * so a burst sharing one timestamp highlights where it starts.
 */
export function getCurrentEventIndex(
  events: TestEventNoMs[],
  currentMs: number,
): number {
  let idx = -1;
  let best = -Infinity;
  for (let i = 0; i < events.length; i++) {
    const ms = (events[i] as TestEventNoMs).testMs;
    if (ms <= currentMs && ms > best) {
      idx = i;
      best = ms;
    }
  }
  return idx;
}

export function getNextEventMs(
  events: TestEventNoMs[],
  currentMs: number,
): number | null {
  let bestMs: number | null = null;
  for (const e of events) {
    if (e.testMs > currentMs && (bestMs === null || e.testMs < bestMs)) {
      bestMs = e.testMs;
    }
  }
  return bestMs;
}

export function getPreviousEventMs(
  events: TestEventNoMs[],
  currentMs: number,
): number | null {
  let bestMs: number | null = null;
  for (const e of events) {
    if (e.testMs < currentMs && (bestMs === null || e.testMs > bestMs)) {
      bestMs = e.testMs;
    }
  }
  return bestMs;
}
