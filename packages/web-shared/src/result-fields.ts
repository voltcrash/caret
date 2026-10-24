// Preserve the web's result check: undefined and NaN are invalid; Infinity is not counted.
export function countInvalidResultFields(input: unknown): number {
  if (typeof input === "number") {
    return isNaN(input) ? 1 : 0;
  } else if (typeof input === "undefined") {
    return 1;
  } else if (typeof input === "object" && input !== null) {
    return Object.values(input).reduce<number>(
      (count, value) => count + countInvalidResultFields(value),
      0,
    );
  } else {
    return 0;
  }
}
