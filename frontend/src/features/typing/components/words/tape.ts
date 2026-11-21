import { isTypingRouteActive } from "../../scope";
import { applyReducedMotion } from "#shared/utils/misc.ts";
import { lineState } from "./line-state";
import { outerWidth } from "./dimensions";
import { getActiveWordElement } from "./elements";
import { hasClassName } from "#shared/utils/cn.ts";
import { animate } from "animejs";
import { peekConfig } from "#shared/config/store.ts";
import { getResultVisible } from "#shared/states/test.ts";
import {
  isDirectionReversed,
  isLanguageRightToLeft,
} from "#features/typing/state/direction.ts";
import {
  getWordsElement as getWordsEl,
  getWordsWrapperElement as getWordsWrapperEl,
} from "#shared/states/test-dom.ts";
import * as Caret from "../../runtime/caret";
import { getCurrentInput } from "../../runtime/events/data";
import * as PaceCaret from "../../runtime/pace-caret";

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
  if (checkIfIncorrect && hasClassName(nlChar.className, "incorrect")) {
    return 0;
  }
  const letterComputedStyle = window.getComputedStyle(nlChar);
  const letterMargin =
    parseFloat(letterComputedStyle.marginLeft) +
    parseFloat(letterComputedStyle.marginRight);
  return nlChar.offsetWidth + letterMargin;
}

function indexOfChild(
  children: HTMLCollectionOf<HTMLElement>,
  child: HTMLElement,
): number {
  return Array.prototype.indexOf.call(children, child);
}

export async function scrollTape(noAnimation = false): Promise<void> {
  if (!isTypingRouteActive() || getResultVisible()) return;

  await lineState.centeringActiveLine;

  const isTestRightToLeft = isDirectionReversed()
    ? !isLanguageRightToLeft()
    : isLanguageRightToLeft();

  const wordsWrapperWidth = getWordsWrapperEl().offsetWidth;
  // Live collection: tape only reads children up to the active line, so
  // never copy every upcoming word on each keystroke.
  const wordsChildrenArr = getWordsEl()
    .children as HTMLCollectionOf<HTMLElement>;
  const activeWordEl = getActiveWordElement();
  if (!activeWordEl) return;
  // Live: removing leading spacers below shifts this collection with them.
  const afterNewLineEls = getWordsEl().getElementsByClassName(
    "afterNewline",
  ) as HTMLCollectionOf<HTMLElement>;

  let wordsWidthBeforeActive = 0;
  let fullLineWidths = 0;
  let leadingNewLine = false;
  let lastAfterNewLineElement = undefined;
  let widthRemoved = 0;
  const widthRemovedFromLine: number[] = [];
  const afterNewlinesNewMargins: number[] = [];
  const toRemove: HTMLElement[] = [];

  /* remove leading `.afterNewline` elements */
  for (const child of wordsChildrenArr) {
    if (hasClassName(child.className, "word")) {
      // only last leading `.afterNewline` element pushes `.word`s to right
      if (lastAfterNewLineElement) {
        widthRemoved += parseFloat(lastAfterNewLineElement.style.marginLeft);
      }
      break;
    } else if (hasClassName(child.className, "afterNewline")) {
      toRemove.push(child);
      leadingNewLine = true;
      lastAfterNewLineElement = child;
    }
  }

  /* get last element to loop over */
  let lastElementIndex: number;
  // index of the active word in all #words.children
  // (which contains .word/.newline/.beforeNewline/.afterNewline elements)
  const activeWordIndex = indexOfChild(wordsChildrenArr, activeWordEl);
  // this will between 0 and 2
  let newLinesBeforeActiveWord = 0;
  for (let i = 0; i < activeWordIndex; i++) {
    if (hasClassName(wordsChildrenArr[i]?.className ?? "", "afterNewline")) {
      newLinesBeforeActiveWord++;
    }
  }
  // the second `.afterNewline` after active word is visible during line jump
  let lastVisibleAfterNewline = afterNewLineEls[newLinesBeforeActiveWord + 1];
  if (lastVisibleAfterNewline) {
    lastElementIndex = indexOfChild(wordsChildrenArr, lastVisibleAfterNewline);
  } else {
    lastVisibleAfterNewline = afterNewLineEls[newLinesBeforeActiveWord];
    if (lastVisibleAfterNewline) {
      lastElementIndex = indexOfChild(
        wordsChildrenArr,
        lastVisibleAfterNewline,
      );
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
    if (hasClassName(child.className, "word")) {
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
    } else if (hasClassName(child.className, "afterNewline")) {
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
  if (peekConfig().tapeMode === "letter" && inputLength > 0) {
    const letters = Array.from(
      activeWordEl.querySelectorAll<HTMLElement>("letter"),
    );
    let lastPositiveLetterWidth = 0;
    for (let i = 0; i < inputLength; i++) {
      const letter = letters[i];
      if (
        (peekConfig().blindMode || peekConfig().hideExtraLetters) &&
        letter !== undefined &&
        hasClassName(letter.className, "extra")
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
  const tapeMarginPx = wordsWrapperWidth * (peekConfig().tapeMargin / 100);
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
    duration: peekConfig().smoothLineScroll ? duration : 0,
    ease,
  };

  Caret.getCaret().handleTapeScroll(caretScrollOptions);
  PaceCaret.getCaret().handleTapeScroll(caretScrollOptions);

  if (peekConfig().smoothLineScroll) {
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
