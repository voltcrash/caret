export {
  nthElementFromArray,
  randomElementFromArray,
  shuffle,
} from "@caret/web-shared/arrays";

/**
 * Applies a conditional smoothing algorithm to an array of numbers.
 * Values are only smoothed if they fall within a specified value window relative to the current value.
 * This preserves large changes in the data while smoothing smaller variations.
 * @param arr The input array of numbers.
 * @param windowSize The size of the window used for smoothing.
 * @param valueWindowSize The maximum difference allowed for values to be included in smoothing.
 * @param getter An optional function to extract values from the array elements. Defaults to the identity function.
 * @returns An array of smoothed values, where each value is the average of itself and nearby values within both the position and value windows.
 */
export function smoothWithValueWindow(
  arr: number[],
  windowSize: number,
  valueWindowSize: number,
  getter = (value: number): number => value,
): number[] {
  const get = getter;
  const result = [];

  for (let i = 0; i < arr.length; i += 1) {
    const currentValue = get(arr[i] as number);
    const leftOffset = i - windowSize;
    const from = leftOffset >= 0 ? leftOffset : 0;
    const to = i + windowSize + 1;

    let count = 0;
    let sum = 0;

    for (let j = from; j < to && j < arr.length; j += 1) {
      const neighborValue = get(arr[j] as number);

      // Only include values that are within the value window
      if (Math.abs(neighborValue - currentValue) <= valueWindowSize) {
        sum += neighborValue;
        count += 1;
      }
    }

    // If no values were within the window, use the original value
    result[i] = count > 0 ? sum / count : currentValue;
  }

  return result;
}

/**
 * Returns the last element of an array.
 * @param array The input array.
 * @returns The last element of the array, or undefined if the array is empty.
 */
export function lastElementFromArray<T>(array: T[]): T | undefined {
  return array[array.length - 1];
}

/**
 * Checks if two unsorted arrays are equal, i.e., they have the same elements regardless of order.
 * @param a The first array.
 * @param b The second array.
 * @returns True if the arrays are equal, false otherwise.
 */
export function areUnsortedArraysEqual<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((v) => b.includes(v));
}

/**
 * Checks if two sorted arrays are equal, i.e., they have the same elements in the same order.
 * @param a The first array.
 * @param b The second array.
 * @returns True if the arrays are equal, false otherwise.
 */
export function areSortedArraysEqual<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
