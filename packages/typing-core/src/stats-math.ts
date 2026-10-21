import { kogasa, mean, roundTo2, stdDev } from "@oxytype/util/numbers";

export { stdDev };

/**
 * Words per minute for a number of characters, counting 5 characters as a word.
 * Raw speed uses the same formula with every typed character.
 * @param charCount Characters to count.
 * @param durationSeconds Elapsed time in seconds.
 * @returns Words per minute, 0 for a non positive duration.
 */
export function calculateWpm(
  charCount: number,
  durationSeconds: number,
): number {
  if (durationSeconds <= 0) return 0;
  return charCount / 5 / (durationSeconds / 60);
}

/**
 * Accuracy percentage of correct inputs.
 * @returns Percentage between 0 and 100, 0 when nothing was typed.
 */
export function calculateAccuracy(correct: number, incorrect: number): number {
  const total = correct + incorrect;
  return total === 0 ? 0 : (correct / total) * 100;
}

/**
 * Consistency of a series (wpm per second, key spacing, ...): the coefficient
 * of variation mapped to 0-100 with kogasa, rounded to 2 decimals.
 * @returns Consistency, 0 when it can not be calculated.
 */
export function calculateConsistency(values: number[]): number {
  const consistency = roundTo2(kogasa(stdDev(values) / mean(values)));
  return isNaN(consistency) ? 0 : consistency;
}
