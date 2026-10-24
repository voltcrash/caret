/**
 * Converts a value in rem units to pixels based on the root element's font size.
 * https://stackoverflow.com/questions/36532307/rem-px-in-javascript
 * @param rem The value in rem units to convert to pixels.
 * @returns The equivalent value in pixels.
 */
export function convertRemToPixels(rem: number): number {
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
}

/**
 * Abbreviates a large number with a suffix (k, m, b, etc.) representing its order of magnitude.
 * @param num The number to abbreviate.
 * @param decimalPoints The number of decimal points to include in the result. Default is 1.
 * @returns The abbreviated number as a string with the appropriate suffix.
 */
export function abbreviateNumber(num: number, decimalPoints = 1): string {
  if (num < 1000) {
    return num.toFixed(decimalPoints);
  }

  const exp = Math.floor(Math.log(num) / Math.log(1000));
  const pre = "kmbtqQsSond".charAt(exp - 1);
  return (num / Math.pow(1000, exp)).toFixed(decimalPoints) + pre;
}

/**
 * Least squares fit over (x, y) points.
 * @returns the fitted line as a function of x, or null for fewer than two distinct x values.
 */
export function fitLine(
  points: { x: number; y: number }[],
): ((x: number) => number) | null {
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denominator = n * sumXX - sumX * sumX;
  if (n < 2 || denominator === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return (x) => slope * x + intercept;
}

/**
 * Finds the line of best fit (least squares regression line) for a set of y-values.
 * @param values_y An array of y-values.
 * @returns An array of two points representing the line (start and end points),
 * or null if the array is empty.
 */
export function findLineByLeastSquares(
  values_y: number[],
): [[number, number], [number, number]] | null {
  let sum_x = 0;
  let sum_y = 0;
  let sum_xy = 0;
  let sum_xx = 0;
  let count = 0;

  /*
   * We'll use those letiables for faster read/write access.
   */
  let x = 0;
  let y = 0;
  const values_length = values_y.length;

  /*
   * Nothing to do.
   */
  if (values_length === 0) {
    return null;
  }

  /*
   * Calculate the sum for each of the parts necessary.
   */
  for (let v = 0; v < values_length; v++) {
    x = v + 1;
    y = values_y[v] as number;
    sum_x += x;
    sum_y += y;
    sum_xx += x * x;
    sum_xy += x * y;
    count++;
  }

  /*
   * Calculate m and b for the formula:
   * y = x * m + b
   */
  const m = (count * sum_xy - sum_x * sum_y) / (count * sum_xx - sum_x * sum_x);
  const b = sum_y / count - (m * sum_x) / count;

  const returnpoint1 = [1, 1 * m + b] as [number, number];
  const returnpoint2 = [values_length, values_length * m + b] as [
    number,
    number,
  ];
  return [returnpoint1, returnpoint2];
}

/**
 * Parses a string into an integer if it is not null or undefined, otherwise returns undefined.
 *
 * @param  The string to parse or null or undefined.
 * @param radix A value between 2 and 36 that specifies the base of the number in `string`.
 * @returns  A number if a string is provided, otherwise undefined.
 */
export function parseIntOptional<T extends string | null | undefined>(
  value: T,
  radix: number = 10,
): T extends string ? number : undefined {
  return (
    value !== null && value !== undefined ? parseInt(value, radix) : undefined
  ) as T extends string ? number : undefined;
}
