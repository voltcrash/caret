/** Terminal npm releases keep UTC date versions (`vYY.MM.DD`). */
export function getDateVersion(date = new Date()) {
  return `v${date.toISOString().slice(2, 10).replaceAll("-", ".")}`;
}
