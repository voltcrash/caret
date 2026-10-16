import { getActiveWordIndex } from "../../../../ts/states/test";
import { getWordsElement as getWordsEl } from "../../../../ts/states/test-dom";
import { updateClassNames } from "../../../../ts/utils/cn";

export function getWordElement(index: number): HTMLElement | null {
  const el = getWordsEl().querySelector<HTMLElement>(
    `.word[data-wordindex='${index}']`,
  );
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
