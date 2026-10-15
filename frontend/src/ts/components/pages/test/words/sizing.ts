import { keepWordsInputInTheCenter } from "./focus";
import { getActiveWordElement, setClass } from "./elements";
import { getMutableConfig } from "../../../../config/store";
import { getInputElement } from "../../../../input/input-element";
import { getActivePage } from "../../../../states/core";
import { setWordsWrapperVisible } from "../../../../states/funbox";
import {
  isDirectionReversed,
  isLanguageRightToLeft,
  setOutOfFocusMaxHeight,
  wordsHaveNewline,
  getResultVisible,
} from "../../../../states/test";
import {
  getWordsElement as getWordsEl,
  getWordsWrapperElement as getWordsWrapperEl,
  getTypingTestElement,
} from "../../../../states/test-dom";
import {
  setWordsInputStyle,
  setWordsWrapperHeight,
} from "../../../../states/words-layout";
import * as CustomText from "../../../../test/custom-text";
import { convertRemToPixels } from "../../../../utils/numbers";
import { getWordsFontScale } from "../../../../utils/words-font";

export function updateWordsInputPosition(): void {
  if (getActivePage() !== "test") return;
  const isTestRightToLeft = isDirectionReversed()
    ? !isLanguageRightToLeft()
    : isLanguageRightToLeft();

  const el = getInputElement();

  if (el === null) return;

  const activeWord = getActiveWordElement();

  if (!activeWord) {
    setWordsInputStyle((previous) => ({
      ...previous,
      top: "0px",
      left: "0px",
    }));
    return;
  }

  const letterHeight =
    convertRemToPixels(getMutableConfig().fontSize) * getWordsFontScale();
  const targetTop =
    activeWord.offsetTop + letterHeight / 2 - el.offsetHeight / 2 + 1; //+1 for half of border

  const wordWidth = activeWord.offsetWidth;
  const left =
    getMutableConfig().tapeMode !== "off"
      ? getWordsWrapperEl().offsetWidth * (getMutableConfig().tapeMargin / 100)
      : wordWidth < letterHeight && isTestRightToLeft
        ? activeWord.offsetLeft - letterHeight
        : Math.max(0, activeWord.offsetLeft);

  // Publish one layout update so input styles settle before scrolling.
  setWordsInputStyle({
    "max-width":
      getMutableConfig().tapeMode !== "off"
        ? `${100 - getMutableConfig().tapeMargin}%`
        : "",
    width: `${Math.max(letterHeight, wordWidth)}px`,
    top: `${targetTop}px`,
    left: `${left}px`,
  });

  keepWordsInputInTheCenter();
}

export function updateWordsWrapperHeight(force = false): void {
  if (getActivePage() !== "test" || getResultVisible()) return;
  if (!force && getMutableConfig().mode !== "custom") return;
  const activeWordEl = getActiveWordElement();
  if (!activeWordEl) return;

  setWordsWrapperVisible(true);

  const wordComputedStyle = window.getComputedStyle(activeWordEl);
  const wordMargin =
    parseInt(wordComputedStyle.marginTop) +
    parseInt(wordComputedStyle.marginBottom);
  const wordHeight = activeWordEl.offsetHeight + wordMargin;

  const timedTest =
    getMutableConfig().mode === "time" ||
    (getMutableConfig().mode === "custom" &&
      CustomText.getLimitMode() === "time") ||
    (getMutableConfig().mode === "custom" && CustomText.getLimitValue() === 0);

  const showAllLines = getMutableConfig().showAllLines && !timedTest;

  if (showAllLines) {
    //allow the wrapper to grow and shink with the words
    setWordsWrapperHeight("");
  } else if (getMutableConfig().mode === "zen") {
    //zen mode, showAllLines off
    setWordsWrapperHeight(`${wordHeight * 2}px`);
  } else {
    if (getMutableConfig().tapeMode === "off") {
      //tape off, showAllLines off, non-zen mode
      const wordElements = Array.from(
        getWordsEl().querySelectorAll<HTMLElement>(".word"),
      );
      let lines = 0;
      let lastTop = 0;
      let wordIndex = 0;
      let wrapperHeight = 0;

      while (lines < 3) {
        const word = wordElements[wordIndex];
        if (!word) break;
        const top = word.offsetTop;
        if (top > lastTop) {
          lines++;
          wrapperHeight += word.offsetHeight + wordMargin;
          lastTop = top;
        }
        wordIndex++;
      }
      if (lines < 3) wrapperHeight = wrapperHeight * (3 / lines);

      //limit to 3 lines
      setWordsWrapperHeight(`${wrapperHeight}px`);
    } else {
      //show 3 lines if tape mode is on and has newlines, otherwise use words height (because of indicate typos: below)
      if (wordsHaveNewline()) {
        setWordsWrapperHeight(`${wordHeight * 3}px`);
      } else {
        const wordsHeight = getWordsEl().offsetHeight ?? wordHeight;
        setWordsWrapperHeight(`${wordsHeight}px`);
      }
    }
  }

  setOutOfFocusMaxHeight(wordHeight * 3);
}

export function updateWordsWidth(): void {
  let css: Record<string, string> = {};
  if (getMutableConfig().tapeMode === "off") {
    if (getMutableConfig().maxLineWidth === 0) {
      css = {
        "max-width": "100%",
      };
    } else {
      css = {
        "max-width": `${getMutableConfig().maxLineWidth}ch`,
      };
    }
  } else {
    if (getMutableConfig().maxLineWidth === 0) {
      css = {
        "max-width": "100%",
      };
    } else {
      css = {
        "max-width": "100%",
      };
    }
  }
  const el = getTypingTestElement();
  if (Object.keys(css).length === 0) {
    el.style.cssText = "";
  } else {
    Object.assign(el.style, css);
  }
  if (getMutableConfig().maxLineWidth === 0) {
    setClass(el, "full-width-padding", false);
    setClass(el, "content", true);
  } else {
    setClass(el, "content", false);
    setClass(el, "full-width-padding", true);
  }
}
