import { isDebugLogging } from "../../../../ts/utils/logger";
import { useInputListener } from "../../../../ts/hooks/useInputListener";
import { moveInputElementCaretToTheEnd } from "../../../../ts/input/input-element";

export function bindMiscListeners(inputEl: HTMLTextAreaElement): void {
  useInputListener(inputEl, "focus", () => {
    moveInputElementCaretToTheEnd();
  });

  useInputListener(inputEl, "copy paste", (event) => {
    event.preventDefault();
  });

  //this might not do anything
  useInputListener(inputEl, "select selectstart", (event) => {
    event.preventDefault();
  });

  useInputListener(inputEl, "selectionchange", (event) => {
    if (isDebugLogging()) {
      const selection = window.getSelection();
      console.debug("wordsInput event selectionchange", {
        event,
        selection: selection?.toString(),
        isCollapsed: selection?.isCollapsed,
        selectionStart: inputEl.selectionStart,
        selectionEnd: inputEl.selectionEnd,
      });
    }

    const hasSelectedText = inputEl.selectionStart !== inputEl.selectionEnd;
    const isCursorAtEnd = inputEl.selectionStart === inputEl.value.length;
    if (hasSelectedText || !isCursorAtEnd) {
      moveInputElementCaretToTheEnd();
    }
  });
}
