import { centerWordsInputEvent } from "../states/words-layout";

function getVisibleViewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}

export function useWordsInputScroll(
  wrapper: HTMLDivElement,
  input: HTMLTextAreaElement,
): void {
  centerWordsInputEvent.useListener((force) => {
    // visualViewport shrinks when the mobile keyboard opens; innerHeight does not on iOS.
    const windowHeight = getVisibleViewportHeight();
    if (wrapper.offsetHeight < windowHeight) return;
    if (!force && input.getBoundingClientRect().top <= windowHeight / 2) return;
    input.scrollIntoView({ block: "center" });
  });
}
