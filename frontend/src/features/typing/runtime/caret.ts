import { getMutableConfig } from "../../../ts/config/store";
import { getCurrentInput } from "./events/data";
import {
  isDirectionReversed,
  isLanguageRightToLeft,
  getActiveWordIndex,
} from "../../../ts/states/test";
import { CaretController } from "../components/words/caret-controller";
import * as CompositionState from "../../../ts/states/composition";
import { getCaretElement } from "../../../ts/states/test-dom";

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
    animate: getMutableConfig().smoothCaret !== "off" && !noAnim,
  });
}

let caret: CaretController | undefined;

// The Caret component creates and disposes the controller.
export function setCaret(controller: CaretController): () => void {
  caret = controller;
  return () => {
    if (caret === controller) caret = undefined;
  };
}

export function getCaret(): CaretController {
  return (caret ??= new CaretController(
    getCaretElement(),
    getMutableConfig().caretStyle,
  ));
}

export function show(noAnim = false): void {
  getCaret().show();
  updatePosition(noAnim);
  startAnimation();
}
