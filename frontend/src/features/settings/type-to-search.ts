// fields that already consume keystrokes, so typing shouldn't be redirected
export function isEditableElement(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  );
}

// single printable characters, so shortcuts, navigation and space (which
// activates the focused button) keep their default behavior
export function isTypeToSearchKey(e: KeyboardEvent): boolean {
  if (e.isComposing || [...e.key].length !== 1 || e.key === " ") return false;
  // ctrl+alt is how AltGr characters arrive on windows
  return !e.metaKey && (!e.ctrlKey || e.getModifierState("AltGraph"));
}
