import { isTypingRouteActive } from "../../scope";
import { keepWordsInputInTheCenter } from "./focus";
import { getActiveWordElement, setClass } from "./elements";
import { peekConfig } from "#shared/config/store.ts";
import { getInputElement } from "#shared/input/input-element.ts";
import { setWordsWrapperVisible } from "#shared/states/funbox.ts";
import { wordsHaveNewline, getResultVisible } from "#shared/states/test.ts";
import { setOutOfFocusMaxHeight } from "#features/typing/state/out-of-focus.ts";
import {
  isDirectionReversed,
  isLanguageRightToLeft,
} from "#features/typing/state/direction.ts";
import {
  getWordsElement as getWordsEl,
  getWordsWrapperElement as getWordsWrapperEl,
  getTypingTestElement,
} from "#shared/states/test-dom.ts";
import {
  setWordsInputStyle,
  setWordsWrapperHeight,
} from "../../state/words-layout";
import * as CustomText from "../../runtime/content/custom-text";
import { convertRemToPixels } from "#shared/utils/numbers.ts";
import { getWordsFontScale } from "./font";

export function updateWordsInputPosition(): void {
  if (!isTypingRouteActive()) return;
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
    convertRemToPixels(peekConfig().fontSize) * getWordsFontScale();
  const targetTop =
    activeWord.offsetTop + letterHeight / 2 - el.offsetHeight / 2 + 1; //+1 for half of border

  const wordWidth = activeWord.offsetWidth;
  const left =
    peekConfig().tapeMode !== "off"
      ? getWordsWrapperEl().offsetWidth * (peekConfig().tapeMargin / 100)
      : wordWidth < letterHeight && isTestRightToLeft
        ? activeWord.offsetLeft - letterHeight
        : Math.max(0, activeWord.offsetLeft);

  // Publish one layout update so input styles settle before scrolling.
  setWordsInputStyle({
    "max-width":
      peekConfig().tapeMode !== "off"
        ? `${100 - peekConfig().tapeMargin}%`
        : "",
    width: `${Math.max(letterHeight, wordWidth)}px`,
    top: `${targetTop}px`,
    left: `${left}px`,
  });

  keepWordsInputInTheCenter();
}

export function updateWordsWrapperHeight(force = false): void {
  if (!isTypingRouteActive() || getResultVisible()) return;
  if (!force && peekConfig().mode !== "custom") return;
  const activeWordEl = getActiveWordElement();
  if (!activeWordEl) return;

  setWordsWrapperVisible(true);
  // measuring before the words have layout (e.g. while hidden) yields zero
  // sizes, which would leave the wrapper unclipped; keep the last height
  if (activeWordEl.offsetHeight === 0) return;

  const wordComputedStyle = window.getComputedStyle(activeWordEl);
  const wordMargin =
    parseInt(wordComputedStyle.marginTop) +
    parseInt(wordComputedStyle.marginBottom);
  const wordHeight = activeWordEl.offsetHeight + wordMargin;

  const timedTest =
    peekConfig().mode === "time" ||
    (peekConfig().mode === "custom" && CustomText.getLimitMode() === "time") ||
    (peekConfig().mode === "custom" && CustomText.getLimitValue() === 0);

  const showAllLines = peekConfig().showAllLines && !timedTest;

  if (showAllLines) {
    //allow the wrapper to grow and shink with the words
    setWordsWrapperHeight("");
  } else if (peekConfig().mode === "zen") {
    //zen mode, showAllLines off
    setWordsWrapperHeight(`${wordHeight * 2}px`);
  } else {
    if (peekConfig().tapeMode === "off") {
      //tape off, showAllLines off, non-zen mode
      // Live collection: only the first lines are read, never every word.
      const wordElements = getWordsEl().getElementsByClassName(
        "word",
      ) as HTMLCollectionOf<HTMLElement>;
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
      // no line below the top yet means no layout to measure
      if (lines === 0) return;
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
  if (peekConfig().tapeMode === "off") {
    if (peekConfig().maxLineWidth === 0) {
      css = {
        "max-width": "100%",
      };
    } else {
      css = {
        "max-width": `${peekConfig().maxLineWidth}ch`,
      };
    }
  } else {
    if (peekConfig().maxLineWidth === 0) {
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
  if (peekConfig().maxLineWidth === 0) {
    setClass(el, "full-width-padding", false);
    setClass(el, "content", true);
  } else {
    setClass(el, "content", false);
    setClass(el, "full-width-padding", true);
  }
}
