import { createBinding } from "#app/binding.ts";
import { peekConfig } from "#shared/config/store.ts";
import { getCurrentInput } from "./events/data";
import {
  isDirectionReversed,
  isLanguageRightToLeft,
  getActiveWordIndex,
} from "#shared/states/test.ts";
import { CaretController } from "../components/words/caret-controller";
import * as CompositionState from "#shared/states/composition.ts";
import { getCaretElement } from "#shared/states/test-dom.ts";

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
