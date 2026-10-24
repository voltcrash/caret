import { randomIntFromRange } from "@oxytype/util/numbers";

/**
 * Shuffle an array of elements using the Fisher–Yates algorithm.
 * This function mutates the input array.
 * @param elements
 */
export function shuffle(elements: unknown[]): void {
  for (let i = elements.length - 1; i > 0; --i) {
    const j = randomIntFromRange(0, i);
    const temp = elements[j];
    elements[j] = elements[i];
    elements[i] = temp;
  }
}

/**
 * Returns a random element from an array.
 * @param array The input array.
 * @returns A random element from the array.
 */
export function randomElementFromArray<T>(array: T[]): T {
  return array[randomIntFromRange(0, array.length - 1)] as T;
}

/**
 * Returns the element at the specified index from an array.
 * Negative index values count from the end of the array.
 * @param array The input array.
 * @param index The index of the element to return.
 * @returns The element at the specified index, or undefined if the index is out of bounds.
 */
export function nthElementFromArray<T>(
  array: T[],
  index: number,
): T | undefined {
  index = index < 0 ? array.length + index : index;
  return array[index];
}

/**
 * Random index following Zipf's law, so lower indexes (more frequent words in
 * a frequency ordered list) come up more often.
 * @param dictLength Length of the list.
 * @returns Random index.
 */
export function zipfyRandomArrayIndex(dictLength: number): number {
  /**
   * get random index based on probability distribution of Zipf's law,
   * where PMF is (1/n)/H_N,
   * where H_N is the Harmonic number of (N), where N is dictLength
   * and the harmonic number is approximated using the formula:
   * H_n = ln(n + 0.5) + gamma
   */
  const gamma = 0.5772156649015329; // Euler–Mascheroni constant
  const H_N = Math.log(dictLength + 0.5) + gamma; // approximation of H_N
  const r = Math.random();
  /* inverse of CDF where CDF is H_n/H_N */
  const inverseCDF = Math.exp(r * H_N - gamma) - 0.5;
  return Math.floor(inverseCDF);
}
