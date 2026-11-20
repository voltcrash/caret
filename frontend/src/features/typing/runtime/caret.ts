import { createBinding } from "../../../app/binding";
import { peekConfig } from "../../../ts/config/store";
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
    animate: peekConfig().smoothCaret !== "off" && !noAnim,
  });
}

// The Caret component creates and disposes the controller.
const caret = createBinding<CaretController>();
export const setCaret = caret.bind;

export function getCaret(): CaretController {
  const current = caret.get();
  if (current !== undefined) return current;
  const controller = new CaretController(
    getCaretElement(),
    peekConfig().caretStyle,
  );
  caret.bind(controller);
  return controller;
}

export function show(noAnim = false): void {
  getCaret().show();
  updatePosition(noAnim);
  startAnimation();
}
