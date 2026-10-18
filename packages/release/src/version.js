/** Website production tags: `vYY.MM.NN`, NN counting that UTC month's releases from 01. */
export const releaseTagPattern = /^v(\d{2})\.(\d{2})\.(\d{2,})$/;

/** `vYY.MM` for the UTC month of `date`. */
export function getReleaseMonth(date = new Date()) {
  return `v${date.toISOString().slice(2, 7).replace("-", ".")}`;
}

/** Orders release tags by year, month and sequence number (01 < 09 < 10 < 100). */
export function compareReleaseTags(a, b) {
  const left = releaseTagPattern.exec(a);
  const right = releaseTagPattern.exec(b);
  if (left === null || right === null) {
    throw new Error(`Not a production release tag: ${left === null ? a : b}`);
  }
  for (let index = 1; index <= 3; index++) {
    const difference = Number(left[index]) - Number(right[index]);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** The next tag of the current month: the first release of a month is `.01`. */
export function getNextReleaseVersion(existingTags, date = new Date()) {
  const month = getReleaseMonth(date);
  const used = existingTags
    .filter((tag) => tag.startsWith(`${month}.`))
    .map((tag) => releaseTagPattern.exec(tag))
    .filter((match) => match !== null)
    .map((match) => Number(match[3]));
  const next = Math.max(0, ...used) + 1;
  return `${month}.${String(next).padStart(2, "0")}`;
}

/** Terminal npm releases keep UTC date versions (`vYY.MM.DD`). */
export function getDateVersion(date = new Date()) {
  return `v${date.toISOString().slice(2, 10).replaceAll("-", ".")}`;
}
