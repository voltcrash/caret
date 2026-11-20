import { createAppOwned } from "#app/application.ts";
import { getActiveWordIndex } from "#shared/states/test.ts";
import { getWordsElement as getWordsEl } from "#shared/states/test-dom.ts";
import { hasClassName, updateClassNames } from "#shared/utils/cn.ts";

// Main/pace carets and input handlers repeatedly read the same few words.
// Bound retention even during infinite tests that remove completed lines.
const wordElements = createAppOwned(() => new Map<number, HTMLElement>());
const maxCachedWords = 32;

// The word last marked active, so word changes need not scan #words for it.
const activeWord = createAppOwned(() => ({
  element: undefined as HTMLElement | undefined,
}));

export function clearWordElements(): void {
  wordElements().clear();
  activeWord().element = undefined;
}

export function rememberActiveWordElement(element: HTMLElement): void {
  activeWord().element = element;
}

/** The rendered `.active` word; verifies the remembered node before use. */
export function findActiveWordElement(): HTMLElement | null {
  const container = getWordsEl();
  const known = activeWord().element;
  if (
    known?.parentElement === container &&
    hasClassName(known.className, "active")
  ) {
    return known;
  }
  return container.querySelector<HTMLElement>(".active");
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
    const next = updateClassNames(
      element.className,
      Array.isArray(names) ? names.join(" ") : names,
      enabled,
    );
    // Even identical writes queue mutations and may invalidate style.
    if (element.className !== next) element.className = next;
  }
}
