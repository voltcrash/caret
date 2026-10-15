import { roundTo2 } from "@oxytype/util/numbers";
import { EventLog } from "../types";

// Produces chart x-axis labels for an array of timer boundaries (the perfect
// grid version). Each bucket is labeled by its index ("1", "2", ...). A
// fractional tail boundary is labeled with its actual time, e.g. "7.25".
// When showLagLabels is true, buckets that contained a catchup-recovery
// moment (real-time burst dump from a stall) are labeled "LAG" to flag that
// their data isn't a true per-second sample.
export function getTimerBoundaryLabels(
  eventLog: EventLog,
  showLagLabels = true,
): string[] {
  const boundaries = getTimerBoundaries(eventLog);
  const catchupTimes: number[] = [];
  if (showLagLabels) {
    for (const event of eventLog.events) {
      if (event.type !== "timer") continue;
      if (event.data.event === "step" && event.data.catchup === true) {
        catchupTimes.push(event.testMs);
      }
    }
  }

  return boundaries.map((boundary, i) => {
    // only the last boundary can be a tail; everything before it is on the grid
    const isLast = i === boundaries.length - 1;
    const isTail = isLast && Math.abs(boundary - (i + 1) * 1000) > 100;
    if (isTail) return roundTo2(boundary / 1000).toFixed(2);
    // bucket spans (prevBoundary, boundary] — mark LAG if a catchup recovery
    // landed inside it (real-time events dumped into one perfect-grid bucket)
    if (showLagLabels) {
      const prevBoundary = i === 0 ? 0 : (boundaries[i - 1] as number);
      const hasCatchup = catchupTimes.some(
        (t) => t > prevBoundary && t <= boundary,
      );
      if (hasCatchup) return "LAG";
    }
    return `${i + 1}`;
  });
}
// Ideal-grid boundaries: evenly spaced at 1-second intervals between start
// and end, regardless of when real step events fired. Use for chart consumers
// that want smooth per-second buckets unaffected by timer drift or catchup
// bursts. For the real fire-time boundaries (drift/catchup-affected), use
// getLaggedTimerBoundaries.
export function getTimerBoundaries(eventLog: EventLog): number[] {
  let endMs: number | undefined;
  let tickCount = 0;
  for (const event of eventLog.events) {
    if (event.type !== "timer") continue;
    if (event.data.event === "end") {
      endMs = event.testMs;
      // Derive tick count from wall-clock (testMs) rather than the end event's
      // Time.get(). The rAF-driven timer freezes on a suspended/backgrounded
      // tab, so Time.get() can undercount real elapsed seconds (it stays 0 for
      // a fully-frozen tab) — testMs, from performance.now(), always reflects
      // true wall-clock. For healthy/mildly-stalled tests the two agree.
      tickCount = Math.floor(endMs / 1000);
    }
  }
  if (endMs === undefined) return [];

  // zen/bailout: trim trailing afk and cap tickCount to fit the adjusted end
  if (eventLog.context.mode === "zen" || eventLog.context.bailedOut) {
    const lkte = getRawLastKeypressToEndMs(eventLog);
    if (lkte < 7000) {
      endMs -= lkte;
      tickCount = Math.min(tickCount, Math.floor(endMs / 1000));
    }
  }

  const boundaries: number[] = [];
  for (let i = 1; i <= tickCount; i++) boundaries.push(i * 1000);

  // append a fractional tail boundary for non-timed tests with a .5s+ remainder
  if (!isTimedTest(eventLog) && Math.round(roundTo2(endMs / 1000) % 1) >= 0.5) {
    boundaries.push(endMs);
  }

  return boundaries;
}
// Real fire-time step boundaries: positions reflect when steps actually
// fired (drift, catchup, etc.). For ideal grid positions, use getTimerBoundaries.
export function getLaggedTimerBoundaries(eventLog: EventLog): number[] {
  const { events } = eventLog;
  const boundaries: number[] = [];
  let endMs: number | undefined;

  for (const event of events) {
    if (event.type !== "timer") continue;
    if (event.data.event === "step") {
      boundaries.push(event.testMs);
    } else if (event.data.event === "end") {
      endMs = event.testMs;
    }
  }

  // in zen/bailout, cap to adjusted end to remove trailing afk seconds
  if (
    endMs !== undefined &&
    (eventLog.context.mode === "zen" || eventLog.context.bailedOut)
  ) {
    const lkte = getRawLastKeypressToEndMs(eventLog);
    if (lkte < 7000) {
      endMs -= lkte;
      while (
        boundaries.length > 0 &&
        (boundaries[boundaries.length - 1] as number) > endMs
      ) {
        boundaries.pop();
      }
    }
  }

  if (endMs !== undefined) {
    if (
      !isTimedTest(eventLog) &&
      Math.round(roundTo2(endMs / 1000) % 1) >= 0.5
    ) {
      boundaries.push(endMs);
    }
  }

  return boundaries;
}
export function isTimedTest(eventLog: EventLog): boolean {
  const { context } = eventLog;
  return (
    context.mode === "time" ||
    (context.mode === "words" && context.mode2 === "0") ||
    (context.mode === "custom" && context.customTextLimitMode === "time") ||
    (context.mode === "custom" && context.customTextLimitValue === 0)
  );
}
export function getStartToFirstKeypressMs(eventLog: EventLog): number {
  if (eventLog.context.mode === "zen") return 0;

  const { events } = eventLog;

  let firstKeypress: number | undefined;
  let start: number | undefined;

  for (const event of events) {
    if (firstKeypress !== undefined && start !== undefined) {
      break;
    }

    if (firstKeypress === undefined && event.type === "keydown") {
      firstKeypress = event.testMs;
    }

    if (
      start === undefined &&
      event.type === "timer" &&
      event.data.event === "start"
    ) {
      start = event.testMs;
    }
  }

  if (firstKeypress === undefined || start === undefined) {
    return 0;
  }

  const calc = firstKeypress - start;
  return calc < 0 ? 0 : roundTo2(calc);
}
// raw version is needed internally by getTestDurationMs to adjust
// duration in zen/bailout — the public version returns 0 for zen
function getRawLastKeypressToEndMs(eventLog: EventLog): number {
  const { events } = eventLog;

  let lastKeypress: number | undefined;
  let end: number | undefined;

  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];

    if (event === undefined) {
      // this is not possible, but typescript shouts at me
      break;
    }

    if (lastKeypress !== undefined && end !== undefined) {
      break;
    }

    if (lastKeypress === undefined && event.type === "keydown") {
      lastKeypress = event.testMs;
    }

    if (
      end === undefined &&
      event.type === "timer" &&
      event.data.event === "end"
    ) {
      end = event.testMs;
    }
  }

  if (lastKeypress === undefined || end === undefined) {
    return 0;
  }

  const calc = end - lastKeypress;
  return calc < 0 ? 0 : roundTo2(calc);
}
export function getLastKeypressToEndMs(eventLog: EventLog): number {
  if (eventLog.context.mode === "zen") return 0;
  return getRawLastKeypressToEndMs(eventLog);
}
export function getTestDurationMs(eventLog: EventLog): number {
  const { events } = eventLog;

  let end: number | undefined;

  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];

    if (event === undefined) {
      // this is not possible, but typescript shouts at me
      break;
    }

    if (
      end === undefined &&
      event.type === "timer" &&
      event.data.event === "end"
    ) {
      end = event.testMs;
      break;
    }
  }

  if (end === undefined) {
    return 0;
  }

  if (eventLog.context.mode === "zen" || eventLog.context.bailedOut) {
    const lkte = getRawLastKeypressToEndMs(eventLog);
    if (lkte < 7000) {
      end -= lkte;
    }
  }

  if (eventLog.context.mode !== "custom") {
    end = roundTo2(end / 1000) * 1000;
  }

  return end;
}
export function getDateBasedTestDurationMs(eventLog: EventLog): number {
  let start: number | undefined;
  let end: number | undefined;

  for (const event of eventLog.events) {
    if (
      start === undefined &&
      event.type === "timer" &&
      event.data.event === "start"
    ) {
      start = event.data.date;
    }
    if (
      end === undefined &&
      event.type === "timer" &&
      event.data.event === "end"
    ) {
      end = event.data.date;
    }
  }

  if (start === undefined || end === undefined) {
    return 0;
  }

  return end - start;
}
