import type { SpeedHistogram, TypingStats } from "@oxytype/schemas/public";

import { intervalToDuration } from "date-fns";

import {
  getNumberWithMagnitude,
  numberWithSpaces,
} from "../../ts/utils/numbers";

type StatDisplay = { label: string; text: string; subText: string };

export type TypingStatsDisplay = Record<
  "timeTyping" | "testsStarted" | "testsCompleted",
  StatDisplay
>;

function magnitude(value: number): Omit<StatDisplay, "label"> {
  const rounded = getNumberWithMagnitude(value);
  return {
    text:
      rounded.rounded < 10
        ? rounded.roundedTo2.toString()
        : rounded.rounded.toString(),
    subText: rounded.orderOfMagnitude,
  };
}

/** About-page presentation of the global counters. */
export function formatTypingStats(data: TypingStats): TypingStatsDisplay {
  const typingSeconds = Math.round(data.timeTyping);
  const typingDuration = intervalToDuration({
    start: 0,
    end: typingSeconds * 1000,
  });
  return {
    timeTyping: {
      label: `${numberWithSpaces(Math.round(typingSeconds / 3600))} hours`,
      text: typingDuration.years?.toString() ?? "",
      subText: "years",
    },
    testsStarted: {
      label: `${numberWithSpaces(data.testsStarted)} tests`,
      ...magnitude(data.testsStarted),
    },
    testsCompleted: {
      label: `${numberWithSpaces(data.testsCompleted)} tests`,
      ...magnitude(data.testsCompleted),
    },
  };
}

export type HistogramBucket = { x: number; y: number; topPercentage?: string };

/** 10 wpm buckets, filling gaps, with each bucket's "top N%" label. */
export function bucketSpeedHistogram(data: SpeedHistogram): {
  labels: string[];
  data: HistogramBucket[];
} {
  const buckets: HistogramBucket[] = [];
  const labels: string[] = [];
  const sum = Object.values(data).reduce((total, it) => total + it, 0);
  let topPercentage = 100;
  const keys = Object.keys(data).sort(
    (a, b) => parseInt(a, 10) - parseInt(b, 10),
  );
  for (const [i, key] of keys.entries()) {
    const nextKey = keys[i + 1];
    const bucket = parseInt(key, 10);
    const count = data[bucket] as number;
    topPercentage -= (count / sum) * 100;
    buckets.push({
      x: bucket,
      y: count,
      topPercentage:
        topPercentage > 0.01 ? `top ${topPercentage.toFixed(2)}%` : undefined,
    });
    labels.push(`${bucket} - ${bucket + 9}`);
    if (nextKey !== undefined && bucket + 10 !== parseInt(nextKey, 10)) {
      for (let j = bucket + 10; j < parseInt(nextKey, 10); j += 10) {
        buckets.push({ x: j, y: 0 });
        labels.push(`${j} - ${j + 9}`);
      }
    }
  }
  return { data: buckets, labels };
}

/** "1.23 million" style total for the histogram caption. */
export function histogramTotal(data: HistogramBucket[]): string {
  const sum = getNumberWithMagnitude(
    data.reduce((total, it) => total + it.y, 0),
  );
  return `${sum.roundedTo2} ${sum.orderOfMagnitude}`;
}
