// narrow screens scale the words down (see --words-font-scale in core.css) so
// a line holds more than a couple of words. the font size setting still applies
export function getWordsFontSize(fontSize: number): string {
  return `calc(${fontSize}rem * var(--words-font-scale, 1))`;
}

export function getWordsFontScale(): number {
  const scale = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(
      "--words-font-scale",
    ),
  );
  return Number.isFinite(scale) ? scale : 1;
}
