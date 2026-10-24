/**
 * Sørensen–Dice coefficient over character bigrams, ignoring whitespace.
 * Port of `compareTwoStrings` from the unmaintained string-similarity package.
 * @returns similarity between 0 and 1
 */
export function compareTwoStrings(first: string, second: string): number {
  const a = first.replace(/\s+/g, "");
  const b = second.replace(/\s+/g, "");
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bigram = a.slice(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) ?? 0) + 1);
  }

  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bigram = b.slice(i, i + 2);
    const count = bigrams.get(bigram) ?? 0;
    if (count > 0) {
      bigrams.set(bigram, count - 1);
      intersection++;
    }
  }

  return (2 * intersection) / (a.length + b.length - 2);
}
