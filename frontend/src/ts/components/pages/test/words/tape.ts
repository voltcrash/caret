import { applyReducedMotion } from "../../../../utils/misc";
import { lineState } from "./line-state";
import { outerWidth } from "./dimensions";
import { getActiveWordElement } from "./elements";
import { animate } from "animejs";
import { getMutableConfig } from "../../../../config/store";
import { getActivePage } from "../../../../states/core";
import {
  isDirectionReversed,
  isLanguageRightToLeft,
  getResultVisible,
} from "../../../../states/test";
import {
  getWordsElement as getWordsEl,
  getWordsWrapperElement as getWordsWrapperEl,
} from "../../../../states/test-dom";
import * as Caret from "../../../../test/caret";
import { getCurrentInput } from "../../../../test/events/data";
import * as PaceCaret from "../../../../test/pace-caret";

// this is needed in tape mode because sometimes we want the newline character to appear above the next line
// and sometimes we want it to be shifted to the left
// (for example if the newline is typed incorrectly, or there are any extra letters after it)
function getNlCharWidth(
  lastWordInLine?: HTMLElement,
  checkIfIncorrect = true,
): number {
  let nlChar: HTMLElement | null;
  if (lastWordInLine) {
    nlChar = lastWordInLine.querySelector<HTMLElement>("letter.nlChar");
  } else {
    nlChar = getWordsEl().querySelector<HTMLElement>(
      ":scope > .word > letter.nlChar",
    );
  }
  if (!nlChar) return 0;
  if (checkIfIncorrect && nlChar.className.split(/\s+/).includes("incorrect")) {
    return 0;
  }
  const letterComputedStyle = window.getComputedStyle(nlChar);
  const letterMargin =
    parseFloat(letterComputedStyle.marginLeft) +
    parseFloat(letterComputedStyle.marginRight);
  return nlChar.offsetWidth + letterMargin;
}

export async function scrollTape(noAnimation = false): Promise<void> {
  if (getActivePage() !== "test" || getResultVisible()) return;

  await lineState.centeringActiveLine;

  const isTestRightToLeft = isDirectionReversed()
    ? !isLanguageRightToLeft()
    : isLanguageRightToLeft();

  const wordsWrapperWidth = getWordsWrapperEl().offsetWidth;
  const wordsChildrenArr = Array.from(
    getWordsEl().children ?? [],
  ) as HTMLElement[];
  const activeWordEl = getActiveWordElement();
  if (!activeWordEl) return;
  const afterNewLineEls = Array.from(
    getWordsEl().querySelectorAll<HTMLElement>(".afterNewline"),
  );

  let wordsWidthBeforeActive = 0;
  let fullLineWidths = 0;
  let leadingNewLine = false;
  let lastAfterNewLineElement = undefined;
  let widthRemoved = 0;
  const widthRemovedFromLine: number[] = [];
  const afterNewlinesNewMargins: number[] = [];
  const toRemove: HTMLElement[] = [];
  let removedAfterNewlines = 0;

  /* remove leading `.afterNewline` elements */
  for (const child of wordsChildrenArr) {
    if (child.className.split(/\s+/).includes("word")) {
      // only last leading `.afterNewline` element pushes `.word`s to right
      if (lastAfterNewLineElement) {
        widthRemoved += parseFloat(lastAfterNewLineElement.style.marginLeft);
      }
      break;
    } else if (child.className.split(/\s+/).includes("afterNewline")) {
      toRemove.push(child);
      leadingNewLine = true;
      lastAfterNewLineElement = child;
      removedAfterNewlines++;
    }
  }

  /* get last element to loop over */
  let lastElementIndex: number;
  // index of the active word in all #words.children
  // (which contains .word/.newline/.beforeNewline/.afterNewline elements)
  const activeWordIndex = wordsChildrenArr.indexOf(activeWordEl);
  // this will between 0 and 2
  const newLinesBeforeActiveWord = wordsChildrenArr
    .slice(0, activeWordIndex)
    .filter((child) =>
      child.className.split(/\s+/).includes("afterNewline"),
    ).length;
  // the second `.afterNewline` after active word is visible during line jump
  let lastVisibleAfterNewline = afterNewLineEls[newLinesBeforeActiveWord + 1];
  if (lastVisibleAfterNewline) {
    lastElementIndex = wordsChildrenArr.indexOf(lastVisibleAfterNewline);
  } else {
    lastVisibleAfterNewline = afterNewLineEls[newLinesBeforeActiveWord];
    if (lastVisibleAfterNewline) {
      lastElementIndex = wordsChildrenArr.indexOf(lastVisibleAfterNewline);
    } else {
      lastElementIndex = activeWordIndex - 1;
    }
  }

  const wordRightMargin = parseFloat(
    window.getComputedStyle(activeWordEl).marginRight,
  );

  /*calculate .afterNewline & #words new margins + determine elements to remove*/
  for (let i = 0; i <= lastElementIndex; i++) {
    const child = wordsChildrenArr[i] as HTMLElement;
    if (child.className.split(/\s+/).includes("word")) {
      leadingNewLine = false;
      const wordOuterWidth = outerWidth(child);
      const wordLeft = Math.floor(child.offsetLeft);
      const wordWidth = Math.floor(child.offsetWidth);
      if (
        (!isTestRightToLeft && wordLeft < 0 - wordWidth) ||
        (isTestRightToLeft && wordLeft > wordsWrapperWidth)
      ) {
        toRemove.push(child);
        widthRemoved += wordOuterWidth;
      } else {
        fullLineWidths += wordOuterWidth;
        if (i < activeWordIndex) wordsWidthBeforeActive = fullLineWidths;
      }
    } else if (child.className.split(/\s+/).includes("afterNewline")) {
      if (leadingNewLine) continue;
      const nlCharWidth = getNlCharWidth(wordsChildrenArr[i - 3]);
      fullLineWidths -= nlCharWidth + wordRightMargin;
      if (i < activeWordIndex) wordsWidthBeforeActive = fullLineWidths;

      /** words that are wider than limit can cause a barely visible bottom line shifting,
       * increase limit if that ever happens, but keep the limit because browsers hate
       * ridiculously wide margins which may cause the words to not be displayed
       */
      const limit = 3 * getWordsEl().offsetWidth;
      if (fullLineWidths < limit) {
        afterNewlinesNewMargins.push(fullLineWidths);
        widthRemovedFromLine.push(widthRemoved);
      } else {
        afterNewlinesNewMargins.push(limit);
        widthRemovedFromLine.push(widthRemoved);
        if (i < lastElementIndex) {
          // for the second .afterNewline after active word
          afterNewlinesNewMargins.push(limit);
          widthRemovedFromLine.push(widthRemoved);
        }
        break;
      }
    }
  }

  /* remove overflown elements */
  if (toRemove.length > 0) {
    for (const el of toRemove) el.remove();
    afterNewLineEls.splice(0, removedAfterNewlines);
    for (let i = 0; i < widthRemovedFromLine.length; i++) {
      const afterNewlineEl = afterNewLineEls[i] as HTMLElement;
      const currentLineIndent =
        parseFloat(afterNewlineEl.style.marginLeft) || 0;
      Object.assign(afterNewlineEl.style, {
        marginLeft: `${currentLineIndent - (widthRemovedFromLine[i] ?? 0)}px`,
      });
    }
    if (isTestRightToLeft) widthRemoved *= -1;
    const currentWordsMargin = parseFloat(getWordsEl().style.marginLeft) || 0;
    Object.assign(getWordsEl().style, {
      marginLeft: `${currentWordsMargin + widthRemoved}px`,
    });
    Caret.getCaret().handleTapeWordsRemoved(widthRemoved);
    PaceCaret.getCaret().handleTapeWordsRemoved(widthRemoved);
  }

  /* calculate current word width to add to #words margin */
  let currentWordWidth = 0;
  const inputLength = getCurrentInput().length;
  if (getMutableConfig().tapeMode === "letter" && inputLength > 0) {
    const letters = Array.from(
      activeWordEl.querySelectorAll<HTMLElement>("letter"),
    );
    let lastPositiveLetterWidth = 0;
    for (let i = 0; i < inputLength; i++) {
      const letter = letters[i];
      if (
        (getMutableConfig().blindMode || getMutableConfig().hideExtraLetters) &&
        letter?.className.split(/\s+/).includes("extra")
      ) {
        continue;
      }
      const letterOuterWidth = letter?.offsetWidth ?? 0;
      currentWordWidth += letterOuterWidth;
      if (letterOuterWidth > 0) lastPositiveLetterWidth = letterOuterWidth;
    }
    // if current letter has zero width move the tape to previous positive width letter
    if (letters[inputLength]?.offsetWidth === 0) {
      currentWordWidth -= lastPositiveLetterWidth;
    }
  }

  /* change to new #words & .afterNewline margins */
  const tapeMarginPx =
    wordsWrapperWidth * (getMutableConfig().tapeMargin / 100);
  let newMarginOffset = wordsWidthBeforeActive + currentWordWidth;
  let newMargin = tapeMarginPx - newMarginOffset;
  if (isTestRightToLeft) {
    newMarginOffset *= -1;
    newMargin = wordRightMargin - newMargin;
  }

  const duration = applyReducedMotion(noAnimation ? 0 : 125);
  const ease = "inOut(1.25)";

  const caretScrollOptions = {
    newValue: newMarginOffset * -1,
    duration: getMutableConfig().smoothLineScroll ? duration : 0,
    ease,
  };

  Caret.getCaret().handleTapeScroll(caretScrollOptions);
  PaceCaret.getCaret().handleTapeScroll(caretScrollOptions);

  if (getMutableConfig().smoothLineScroll) {
    animate(getWordsEl(), {
      marginLeft: newMargin,
      duration,
      ease,
    });

    for (let i = 0; i < afterNewlinesNewMargins.length; i++) {
      const newMargin = afterNewlinesNewMargins[i] ?? 0;
      animate(afterNewLineEls[i] as HTMLElement, {
        marginLeft: newMargin,
        duration,
        ease,
      });
    }
  } else {
    Object.assign(getWordsEl().style, { marginLeft: `${newMargin}px` });
    for (let i = 0; i < afterNewlinesNewMargins.length; i++) {
      const newMargin = afterNewlinesNewMargins[i] ?? 0;
      const afterNewline = afterNewLineEls[i];
      if (afterNewline) {
        Object.assign(afterNewline.style, { marginLeft: `${newMargin}px` });
      }
    }
  }
}
