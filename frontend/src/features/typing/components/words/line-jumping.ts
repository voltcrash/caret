import { lineState, updateActiveWordGeometry } from "./line-state";
import { updateWordsWrapperHeight } from "./sizing";
import { outerHeight } from "./dimensions";
import { getWordElement, getActiveWordElement } from "./elements";
import { animateAsync } from "../../../../ts/anim";
import { getMutableConfig } from "../../../../ts/config/store";
import { getActiveWordIndex } from "../../../../ts/states/test";
import { getWordsElement as getWordsEl } from "../../../../ts/states/test-dom";
import * as Caret from "../../runtime/caret";
import * as PaceCaret from "../../runtime/pace-caret";
import * as Misc from "../../../../ts/utils/misc";

export async function centerActiveLine(): Promise<void> {
  if (getMutableConfig().showAllLines) {
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
  const wordsChildren = Array.from(
    getWordsEl().children ?? [],
  ) as HTMLElement[];

  if (wordsChildren === undefined) return;

  for (let i = lastElementIndexToRemove; i >= 0; i--) {
    const child = wordsChildren[i];
    if (!child || !child.isConnected) continue;
    child.remove();
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
    const wordsChildren = Array.from(
      getWordsEl().children ?? [],
    ) as HTMLElement[];
    const activeWordElementIndex = wordsChildren.indexOf(activeWordEl);

    let lastElementIndexToRemove: number | undefined = undefined;
    for (let i = activeWordElementIndex - 1; i >= 0; i--) {
      const child = wordsChildren[i] as HTMLElement;
      if (child.className.split(/\s+/).includes("hidden")) continue;
      if (Math.floor(child.offsetTop) < hideBound) {
        if (child.className.split(/\s+/).includes("word")) {
          lastElementIndexToRemove = i;
          break;
        } else if (child.className.split(/\s+/).includes("beforeNewline")) {
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
      duration: getMutableConfig().smoothLineScroll ? duration : 0,
    };
    Caret.getCaret().handleLineJump(caretLineJumpOptions);
    PaceCaret.getCaret().handleLineJump(caretLineJumpOptions);

    if (getMutableConfig().smoothLineScroll) {
      lineState.lineTransition = true;
      await animateAsync(getWordsEl(), {
        marginTop: newMarginTop,
        duration,
      });
      lineState.currentLinesJumping = 0;
      updateActiveWordGeometry(activeWordEl);
      removeTestElements(lastElementIndexToRemove);
      Object.assign(getWordsEl().style, { marginTop: "0" });
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
