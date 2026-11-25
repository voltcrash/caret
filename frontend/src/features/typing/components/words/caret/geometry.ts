import { CaretStyle } from "@caret/schemas/configs";

import { peekConfig } from "#shared/config/store.ts";
import {
  getWordsElement as getWordsCache,
  getWordsWrapperElement as getWordsWrapperCache,
} from "#features/typing/state/test-dom.ts";
import { isWordRightToLeft } from "#shared/utils/strings.ts";

import { isCaretDebugEnabled } from "./debug";
import { getTotalInlineMargin, setCaretClass } from "./dom";
import { getWordsOffsetX, getWordsOffsetY } from "../words-scroll";

const fullWidthStyles: ReadonlySet<CaretStyle> = new Set([
  "block",
  "outline",
  "underline",
]);

export const lockedMainCaretInTape = true;

export function isFullWidthCaretStyle(style: CaretStyle): boolean {
  return fullWidthStyles.has(style);
}

/** The caret state that target measurement reads. */
export type CaretMeasurement = {
  id: string;
  element: HTMLElement;
  style: CaretStyle;
  isMainCaret: boolean;
  wordMargins: WeakMap<HTMLElement, number>;
  getWidth: () => number;
  getHeight: () => number;
};

export function getCaretTargetPositionAndWidth(
  caret: CaretMeasurement,
  options: {
    word: HTMLElement;
    letterIndex: number;
    wordText: string;
    side: "beforeLetter" | "afterLetter";
    isLanguageRightToLeft: boolean;
    isDirectionReversed: boolean;
  },
): { left: number; top: number; width: number } {
  // Live collection: indexed reads only, no per-move NodeList copy.
  const letters = options.word.getElementsByTagName(
    "letter",
  ) as HTMLCollectionOf<HTMLElement>;

  if (letters.length === 0) {
    throw new Error(
      "Caret getTargetPositionAndWidth: no letters found in word",
    );
  }

  // Letters may lag the target index for a frame; clamp to rendered ones.
  const letterIndex = Math.min(options.letterIndex, letters.length - 1);
  let letter = letters[letterIndex];

  if (!letter) {
    throw new Error(
      `Caret getTargetPositionAndWidth: letter not found for index ${options.letterIndex}`,
    );
  }

  if (isCaretDebugEnabled()) {
    if (caret.id === "paceCaret") {
      for (const l of getWordsCache().querySelectorAll<HTMLElement>(
        ".word letter",
      )) {
        setCaretClass(l, "debugCaretTarget", false);
        setCaretClass(l, "debugCaretTarget2", false);
        setCaretClass(l, "debugCaret", true);
      }
      setCaretClass(letter, "debugCaretTarget", true);
      setCaretClass(caret.element, "debug", true);
    }
  } else {
    setCaretClass(caret.element, "debug", false);
  }

  // in zen, custom or polyglot mode we need to check per-letter
  const checkRtlByLetter =
    peekConfig().mode === "zen" ||
    peekConfig().mode === "custom" ||
    peekConfig().funbox.includes("polyglot");
  const [isWordRTL, isFullMatch] = isWordRightToLeft(
    checkRtlByLetter ? (letter.textContent ?? "") : options.wordText,
    options.isLanguageRightToLeft,
    options.isDirectionReversed,
  );

  //if the letter is not visible, use the closest visible letter
  const isLetterVisible = letter.offsetWidth > 0;
  if (!isLetterVisible) {
    for (let i = letterIndex - 1; i >= 0; i--) {
      const loopLetter = letters[i] as HTMLElement;

      // find the closest visible letter before the current letter
      if (loopLetter.offsetWidth > 0) {
        letter = loopLetter;
        break;
      }
    }
    if (isCaretDebugEnabled()) {
      setCaretClass(letter, "debugCaretTarget2", true);
    }
  }

  let spaceWidth = caret.wordMargins.get(options.word);
  if (spaceWidth === undefined) {
    spaceWidth = getTotalInlineMargin(options.word);
    caret.wordMargins.set(options.word, spaceWidth);
  }
  let width = spaceWidth;
  if (isFullWidthCaretStyle(caret.style) && options.side === "beforeLetter") {
    width = letter.offsetWidth;
  }

  let left = 0;
  let top = 0;

  const tapeOffset =
    getWordsWrapperCache().offsetWidth * (peekConfig().tapeMargin / 100);
  const wordsOffsetX = getWordsOffsetX();
  const wordsOffsetY = getWordsOffsetY();
  const wordLeft = options.word.offsetLeft + wordsOffsetX;
  const wordTop = options.word.offsetTop + wordsOffsetY;

  // yes, this is all super verbose, but its easier to maintain and understand
  if (isWordRTL) {
    if (!checkRtlByLetter && isFullMatch) {
      setCaretClass(options.word, "wordRtl", true);
    }
    let afterLetterCorrection = 0;
    if (options.side === "afterLetter") {
      if (isFullWidthCaretStyle(caret.style)) {
        afterLetterCorrection += spaceWidth * -1;
      } else {
        afterLetterCorrection += letter.offsetWidth * -1;
      }
    }
    if (peekConfig().tapeMode === "off") {
      if (!isFullWidthCaretStyle(caret.style)) {
        left += letter.offsetWidth;
      }
      left += letter.offsetLeft;
      left += wordLeft;
      left += afterLetterCorrection;
    } else if (peekConfig().tapeMode === "word") {
      if (!isFullWidthCaretStyle(caret.style)) {
        left += letter.offsetWidth;
      }
      left += options.word.offsetWidth * -1;
      left += letter.offsetLeft;
      left += afterLetterCorrection;
      if (caret.isMainCaret && lockedMainCaretInTape) {
        left += getWordsWrapperCache().offsetWidth - tapeOffset;
      } else {
        left += wordLeft;
        left += options.word.offsetWidth;
      }
    } else if (peekConfig().tapeMode === "letter") {
      if (isFullWidthCaretStyle(caret.style)) {
        left += width * -1;
      }
      if (caret.isMainCaret && lockedMainCaretInTape) {
        left += getWordsWrapperCache().offsetWidth - tapeOffset;
      } else {
        left += letter.offsetLeft;
        left += wordLeft;
        left += afterLetterCorrection;
        left += width;
      }
    }
  } else {
    let afterLetterCorrection = 0;
    if (options.side === "afterLetter") {
      afterLetterCorrection += letter.offsetWidth;
    }
    if (peekConfig().tapeMode === "off") {
      left += letter.offsetLeft;
      left += wordLeft;
      left += afterLetterCorrection;
    } else if (peekConfig().tapeMode === "word") {
      left += letter.offsetLeft;
      left += afterLetterCorrection;
      if (caret.isMainCaret && lockedMainCaretInTape) {
        left += tapeOffset;
      } else {
        left += wordLeft;
      }
    } else if (peekConfig().tapeMode === "letter") {
      if (caret.isMainCaret && lockedMainCaretInTape) {
        left += tapeOffset;
      } else {
        left += letter.offsetLeft;
        left += wordLeft;
        left += afterLetterCorrection;
      }
    }
  }

  //top position
  top += letter.offsetTop;
  top += wordTop;

  if (caret.style === "underline") {
    // if style is underline, add the height of the letter to the top
    top += letter.offsetHeight;
  } else {
    // else center vertically in the letter
    top += (letter.offsetHeight - caret.getHeight()) / 2;
  }

  // also center horizontally
  if (!isFullWidthCaretStyle(caret.style)) {
    left += (caret.getWidth() / 2) * -1;
  }

  return {
    left,
    top,
    width,
  };
}
