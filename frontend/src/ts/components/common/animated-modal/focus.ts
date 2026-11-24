const FIRST_INPUT_SELECTOR =
  "input:not([type=hidden]):not([disabled]):not(.hidden), textarea:not([disabled]):not(.hidden)";
const TABBABLE_SELECTOR =
  "button, a[href], input, textarea, select, [tabindex]";

/** Moves focus into freshly shown modal content. */
export function focusModalContent(
  modal: HTMLElement | undefined,
  focusFirstInput: true | "focusAndSelect" | undefined,
): void {
  if (focusFirstInput === undefined) {
    // Native modal dialogs select their initial focus. Keep it unless the
    // content contains no focusable control; then focus its owned container.
    if (!modal?.contains(document.activeElement)) modal?.focus();
    return;
  }

  const input = modal?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    FIRST_INPUT_SELECTOR,
  );
  if (input) {
    if (focusFirstInput === true) {
      input.focus();
    } else if (focusFirstInput === "focusAndSelect") {
      input.focus();
      input.select();
    }
  }
}

/** Keeps Tab and Shift+Tab cycling inside the modal content. */
export function trapModalTabFocus(
  e: KeyboardEvent,
  modal: HTMLElement | undefined,
): void {
  const focusable = Array.from(
    modal?.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR) ?? [],
  ).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.hasAttribute("disabled") &&
      element.getClientRects().length > 0,
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (first === undefined) {
    e.preventDefault();
    modal?.focus();
  } else if (
    e.shiftKey &&
    (document.activeElement === first || document.activeElement === modal)
  ) {
    e.preventDefault();
    last?.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/** Returns focus to its opener once the last open dialog closes. */
export function restoreModalFocus(
  returnFocus: HTMLElement | undefined,
  isChained: boolean,
): void {
  if (
    !isChained &&
    returnFocus?.isConnected &&
    document.querySelector("dialog[open]") === null
  ) {
    returnFocus.focus({ preventScroll: true });
  }
}
