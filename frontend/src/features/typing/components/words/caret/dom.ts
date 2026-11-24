import { updateClassNames } from "#shared/utils/cn.ts";

export function setCaretClass(
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
    if (element.className !== next) element.className = next;
  }
}

export function getTotalInlineMargin(element: HTMLElement): number {
  const computedStyle = window.getComputedStyle(element);
  return (
    parseInt(computedStyle.marginRight) + parseInt(computedStyle.marginLeft)
  );
}
