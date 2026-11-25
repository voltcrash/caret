import { lineState, updateActiveWordGeometry } from "./line-state";
import { updateWordsWrapperHeight } from "./sizing";
import { outerHeight } from "./dimensions";
import { getWordElement, getActiveWordElement } from "./elements";
import { lineJumpEasing } from "./caret-easing";
import { getWordsScroll } from "./words-scroll";
import { peekConfig } from "#shared/config/store.ts";
import { getActiveWordIndex } from "#features/typing/state/active-word.ts";
import { getWordsElement as getWordsEl } from "#features/typing/state/test-dom.ts";
import * as Caret from "../../runtime/caret";
import * as PaceCaret from "../../runtime/pace-caret";
import * as Misc from "#shared/utils/misc.ts";
import { hasClassName } from "#shared/utils/cn.ts";

export async function centerActiveLine(): Promise<void> {
  if (peekConfig().showAllLines) {
    return;
  }

  const { resolve, promise } = Misc.promiseWithResolvers();
  lineState.centeringActiveLine = promise;

  const activeWordEl = getActiveWordElement();
  if (!activeWordEl) {
    resolve();
    return;
  }
  const currentTop = activeWordEl.offsetTop;

  let previousLineTop = currentTop;
  for (let i = getActiveWordIndex() - 1; i >= 0; i--) {
    previousLineTop = getWordElement(i)?.offsetTop ?? currentTop;
    if (previousLineTop < currentTop) {
      await lineJump(previousLineTop, true);
      resolve();
      return;
    }
  }

  resolve();
}

function removeTestElements(lastElementIndexToRemove: number): void {
  // Removing from the end keeps lower indices of the live collection stable.
  const wordsChildren = getWordsEl().children;
  for (let i = lastElementIndexToRemove; i >= 0; i--) {
    wordsChildren[i]?.remove();
  }
}

export async function lineJump(
  currentTop: number,
  force = false,
): Promise<void> {
  //last word of the line
  if (lineState.currentTestLine > 0 || force) {
    const hideBound = currentTop;

    const activeWordEl = getActiveWordElement();
    if (!activeWordEl) return;

    // index of the active word in all #words.children
    // (which contains .word/.newline/.beforeNewline/.afterNewline elements)
    const wordsChildren = getWordsEl()
      .children as HTMLCollectionOf<HTMLElement>;
    const activeWordElementIndex = Array.prototype.indexOf.call(
      wordsChildren,
      activeWordEl,
    );

    let lastElementIndexToRemove: number | undefined = undefined;
    for (let i = activeWordElementIndex - 1; i >= 0; i--) {
      const child = wordsChildren[i] as HTMLElement;
      if (hasClassName(child.className, "hidden")) continue;
      if (Math.floor(child.offsetTop) < hideBound) {
        if (hasClassName(child.className, "word")) {
          lastElementIndexToRemove = i;
          break;
        } else if (hasClassName(child.className, "beforeNewline")) {
          // set it to .newline but check .beforeNewline.offsetTop
          // because it's more reliable
          lastElementIndexToRemove = i + 1;
          break;
        }
      }
    }

    if (lastElementIndexToRemove === undefined) {
      lineState.currentTestLine++;
      updateWordsWrapperHeight();
      return;
    }

    lineState.currentLinesJumping++;

    const wordHeight = outerHeight(activeWordEl);
    const newMarginTop = -1 * wordHeight * lineState.currentLinesJumping;
    const duration = Misc.applyReducedMotion(125);

    const caretLineJumpOptions = {
      newMarginTop,
      duration: peekConfig().smoothLineScroll ? duration : 0,
    };
    Caret.getCaret().handleLineJump(caretLineJumpOptions);
    PaceCaret.getCaret().handleLineJump(caretLineJumpOptions);

    if (peekConfig().smoothLineScroll) {
      lineState.lineTransition = true;
      const outcome = await getWordsScroll().animateY(
        newMarginTop,
        duration,
        lineJumpEasing,
      );
      if (outcome === "superseded") return;
      if (outcome === "reset") {
        lineState.currentLinesJumping = 0;
        lineState.lineTransition = false;
        return;
      }
      lineState.currentLinesJumping = 0;
      removeTestElements(lastElementIndexToRemove);
      getWordsScroll().resetY();
      updateActiveWordGeometry(activeWordEl);
      lineState.lineTransition = false;
    } else {
      lineState.currentLinesJumping = 0;
      removeTestElements(lastElementIndexToRemove);
    }
  }
  lineState.currentTestLine++;
  updateWordsWrapperHeight();
  return;
}
