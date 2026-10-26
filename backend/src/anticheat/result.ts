import type { CompletedEvent } from "@caret/schemas/results";
import { kogasa, mean, roundTo2, stdDev } from "@caret/util/numbers";

export type ResultFailure =
  | "invalid-number"
  | "invalid-character-count"
  | "score-mismatch"
  | "speed-limit"
  | "invalid-duration"
  | "invalid-mode"
  | "incomplete-test-mismatch"
  | "invalid-chart"
  | "consistency-mismatch";

export const SCORE_TOLERANCE = 0.011;
const TIMED_TEST_TOLERANCE_SECONDS = 0.25;
export const TELEMETRY_CUTOFF_SECONDS = 122;

export function consistency(values: number[]): number {
  const value = roundTo2(kogasa(stdDev(values) / mean(values)));
  return Number.isFinite(value) ? value : 0;
}

function finiteNonnegative(value: number): boolean {
  return (
    Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER
  );
}

/** Check relationships emitted by test-logic.ts, after request schema validation. */
export function getResultFailure(
  result: CompletedEvent,
): ResultFailure | undefined {
  if (
    Object.values(result).some(
      (value) => typeof value === "number" && !finiteNonnegative(value),
    ) ||
    !result.charStats.every(Number.isSafeInteger) ||
    !Number.isSafeInteger(result.charTotal) ||
    !Number.isSafeInteger(result.restartCount)
  ) {
    return "invalid-number";
  }

  const [correct, incorrect, extra] = result.charStats;
  // correctWord excludes correct letters in incorrect words. Missed letters
  // were never typed, so neither belongs in a raw-WPM equality with charStats.
  if (result.charTotal < correct + incorrect + extra) {
    return "invalid-character-count";
  }
  if (result.testDuration < 1 || result.afkDuration > result.testDuration) {
    return "invalid-duration";
  }
  const speedLimit =
    result.mode === "words" && result.mode2 === "10" ? 420 : 350;
  if (result.wpm > speedLimit || result.rawWpm > speedLimit) {
    return "speed-limit";
  }
  if (
    Math.abs(result.wpm - (correct * 12) / result.testDuration) >
      SCORE_TOLERANCE ||
    Math.abs(result.rawWpm - (result.charTotal * 12) / result.testDuration) >
      SCORE_TOLERANCE
  ) {
    return "score-mismatch";
  }

  let timeLimit: number | undefined;
  if (result.mode === "time" || result.mode === "words") {
    if (
      !/^\d+$/.test(result.mode2) ||
      !Number.isSafeInteger(Number(result.mode2))
    ) {
      return "invalid-mode";
    }
    if (result.mode === "time") timeLimit = Number(result.mode2);
  }
  if (result.mode === "custom") {
    if (
      !result.customText ||
      !finiteNonnegative(result.customText.limit.value)
    ) {
      return "invalid-mode";
    }
    if (result.customText.limit.mode === "time") {
      timeLimit = result.customText.limit.value;
    }
  } else if (result.customText !== undefined) {
    return "invalid-mode";
  }
  // Delayed timers may lengthen tests; they must not shorten the advertised
  // interval. Bailouts and infinite tests intentionally have no such minimum.
  if (
    !result.bailedOut &&
    timeLimit !== undefined &&
    timeLimit > 0 &&
    result.testDuration + TIMED_TEST_TOLERANCE_SECONDS < timeLimit
  ) {
    return "invalid-duration";
  }

  if (
    result.incompleteTests.length !== result.restartCount ||
    result.incompleteTests.some(
      (test) =>
        !finiteNonnegative(test.seconds) ||
        !Number.isFinite(test.acc) ||
        test.acc < 0 ||
        test.acc > 100,
    ) ||
    Math.abs(
      result.incompleteTests.reduce((sum, test) => sum + test.seconds, 0) -
        result.incompleteTestSeconds,
    ) > SCORE_TOLERANCE
  ) {
    return "incomplete-test-mismatch";
  }

  if (result.chartData === "toolong") {
    if (result.testDuration <= TELEMETRY_CUTOFF_SECONDS) return "invalid-chart";
  } else {
    const { wpm, burst, err } = result.chartData;
    if (
      wpm.length !== burst.length ||
      wpm.length !== err.length ||
      wpm.length > Math.ceil(result.testDuration) + 1 ||
      ![...wpm, ...burst, ...err].every(finiteNonnegative)
    ) {
      return "invalid-chart";
    }
    if (
      Math.abs(result.consistency - consistency(burst)) > SCORE_TOLERANCE ||
      Math.abs(result.wpmConsistency - consistency(wpm)) > SCORE_TOLERANCE
    ) {
      return "consistency-mismatch";
    }
  }
  return undefined;
}
