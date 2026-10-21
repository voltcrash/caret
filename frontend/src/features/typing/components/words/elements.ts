import { getActiveWordIndex } from "../../../../ts/states/test";
import { getWordsElement as getWordsEl } from "../../../../ts/states/test-dom";
import { updateClassNames } from "../../../../ts/utils/cn";

// Main/pace carets and input handlers repeatedly read the same few words.
// Bound retention even during infinite tests that remove completed lines.
const wordElements = createAppOwned(() => new Map<number, HTMLElement>());
const maxCachedWords = 32;

export function clearWordElements(): void {
  wordElements().clear();
}

export function getWordElement(index: number): HTMLElement | null {
  const container = getWordsEl();
  const cache = wordElements();
  const cached = cache.get(index);
  if (cached?.parentElement === container) return cached;
  cache.delete(index);
  const el = container.querySelector<HTMLElement>(
    `.word[data-wordindex='${index}']`,
  );
  if (el !== null) {
    if (cache.size === maxCachedWords) {
      cache.delete(cache.keys().next().value as number);
    }
    cache.set(index, el);
  }
  return el;
}

export function getActiveWordElement(): HTMLElement | null {
  return getWordElement(getActiveWordIndex());
}

export function setClass(
  element: HTMLElement | undefined | null,
  names: string | string[],
  enabled: boolean,
): void {
  if (element) {
    element.className = updateClassNames(
      element.className,
      Array.isArray(names) ? names.join(" ") : names,
      enabled,
    );
  }
}
import { createAppOwned } from "../../../../app/application";
