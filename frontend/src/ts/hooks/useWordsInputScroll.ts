import { onCleanup } from "solid-js";

import { centerWordsInputEvent } from "../states/words-layout";

// Band (fractions of the visible viewport) the active line should stay in while typing on touch.
const LINE_BAND_MIN = 0.2;
const LINE_BAND_MAX = 0.5;
const LINE_TARGET = 0.35;

function getVisibleViewportHeight(): number {
  return window.visualViewport?.height ?? window.innerHeight;
}

function isCoarsePointer(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

// iOS does not shrink window.innerHeight when the keyboard opens, so the
// visual viewport is the only reliable picture of the area above the keyboard.
function keepInputAboveKeyboard(input: HTMLTextAreaElement): void {
  if (!isCoarsePointer()) return;
  if (document.activeElement !== input) return;
  const viewport = window.visualViewport;
  if (viewport === null) return;

  const visibleTop = viewport.offsetTop;
  const visibleHeight = viewport.height;
  const rect = input.getBoundingClientRect();
  const lineCenter = rect.top + rect.height / 2;

  const minY = visibleTop + visibleHeight * LINE_BAND_MIN;
  const maxY = visibleTop + visibleHeight * LINE_BAND_MAX;
  if (lineCenter >= minY && lineCenter <= maxY) return;

  // Only scrolls when the line leaves the band, so typing within a line never jitters.
  window.scrollBy({
    top: lineCenter - (visibleTop + visibleHeight * LINE_TARGET),
  });
}

export function useWordsInputScroll(
  wrapper: HTMLDivElement,
  input: HTMLTextAreaElement,
): void {
  centerWordsInputEvent.useListener((force) => {
    if (isCoarsePointer() && document.activeElement === input) {
      keepInputAboveKeyboard(input);
      return;
    }
    // visualViewport shrinks when the mobile keyboard opens; innerHeight does not on iOS.
    const windowHeight = getVisibleViewportHeight();
    if (wrapper.offsetHeight < windowHeight) return;
    if (!force && input.getBoundingClientRect().top <= windowHeight / 2) return;
    input.scrollIntoView({ block: "center" });
  });

  // Keyboard open/close on touch: re-band the active line inside the visible area.
  const viewport = window.visualViewport;
  if (viewport !== null) {
    const onViewportResize = (): void => keepInputAboveKeyboard(input);
    viewport.addEventListener("resize", onViewportResize);
    onCleanup(() => viewport.removeEventListener("resize", onViewportResize));
  }
}
