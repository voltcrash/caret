import { cancelPendingAnimationFrame } from "../utils/debounced-animation-frame";
import { Config } from "../config/store";
import { getCurrentInput } from "./events/data";
import {
  isDirectionReversed,
  isLanguageRightToLeft,
  getActiveWordIndex,
} from "../states/test";
import { configEvent } from "../events/config";
import { Caret } from "../elements/caret";
import * as CompositionState from "../states/composition";
import { areTestElementsMounted, getCaretElement } from "../states/test-dom";

export function stopAnimation(): void {
  getCaret().stopBlinking();
}

export function startAnimation(): void {
  getCaret().startBlinking();
}

export function hide(): void {
  getCaret().hide();
}

export function resetPosition(): void {
  getCaret().stopAllAnimations();
  getCaret().clearMargins();
  getCaret().goTo({
    wordIndex: 0,
    letterIndex: 0,
    isLanguageRightToLeft: isLanguageRightToLeft(),
    isDirectionReversed: isDirectionReversed(),
    animate: false,
  });
}

export function updatePosition(noAnim = false): void {
  getCaret().goTo({
    wordIndex: getActiveWordIndex(),
    letterIndex: getCurrentInput().length + CompositionState.getData().length,
    isLanguageRightToLeft: isLanguageRightToLeft(),
    isDirectionReversed: isDirectionReversed(),
    animate: Config.smoothCaret !== "off" && !noAnim,
  });
}

let caret: Caret | undefined;

// The component owns the node and cancels its animations on disposal.
export function bindCaret(element: HTMLDivElement): () => void {
  const instance = new Caret(element, Config.caretStyle);
  caret = instance;
  return () => {
    instance.stopAllAnimations();
    cancelPendingAnimationFrame(`caret.${element.id}.goTo`);
    if (caret === instance) caret = undefined;
  };
}

export function getCaret(): Caret {
  return (caret ??= new Caret(getCaretElement(), Config.caretStyle));
}

configEvent.subscribe(
  ({ key }) => {
    if (!areTestElementsMounted()) return;
    if (key === "caretStyle") {
      getCaret().setStyle(Config.caretStyle);
      updatePosition(true);
    }
    if (key === "smoothCaret") {
      getCaret().updateBlinkingAnimation();
    }
  },
  import.meta.hot,
);

export function show(noAnim = false): void {
  getCaret().show();
  updatePosition(noAnim);
  startAnimation();
}
