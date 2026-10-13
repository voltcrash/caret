import {
  outerWidth,
  outerHeight,
  scrollToCenterOrTop,
} from "./words/dimensions";
import {
  getWordElement,
  getActiveWordElement,
  setClass,
} from "./words/elements";
export { getWordElement, getActiveWordElement } from "./words/elements";
import * as Numbers from "@oxytype/util/numbers";
import { animate } from "animejs";
import { createEffect, JSXElement, onCleanup, onMount } from "solid-js";

import { animateAsync } from "../../../anim";
import { Config } from "../../../config/store";
import * as SoundController from "../../../controllers/sound-controller";
import * as ThemeController from "../../../controllers/theme-controller";
import { configEvent } from "../../../events/config";
import { highlight } from "../../../events/keymap";
import { useWordsFocus } from "../../../hooks/useWordsFocus";
import {
  blurInputElement,
  focusInputElement,
  isTouchKeyboardFocused,
  getInputElement,
  isInputElementFocused,
} from "../../../input/input-element";
import { getBackground } from "../../../states/background";
import * as CompositionState from "../../../states/composition";
import * as ConnectionState from "../../../states/connection";
import { getActivePage } from "../../../states/core";
import { setWordsWrapperVisible } from "../../../states/funbox";
import { skipBreakdownEvent } from "../../../states/header";
import { getResultElement, setResultState } from "../../../states/result";
import * as SlowTimer from "../../../states/slow-timer";
import {
  isDirectionReversed,
  isLanguageRightToLeft,
  getActiveWordIndex,
  isTestActive,
  setCompositionText,
  setCurrentLiveStats,
  setOutOfFocusMaxHeight,
  wordsHaveNewline,
  setTestFocusState,
  getResultVisible,
  setTestInitError,
} from "../../../states/test";
import {
  areTestElementsMounted,
  getWordsElement as getWordsEl,
  getWordsWrapperElement as getWordsWrapperEl,
  getWordsInputElement,
  getCaretElement,
  getPaceCaretElement,
  getTypingTestElement,
} from "../../../states/test-dom";
import {
  centerWordsInputEvent,
  setWordsInputStyle,
  setWordsWrapperHeight,
} from "../../../states/words-layout";
import * as Caret from "../../../test/caret";
import * as CustomText from "../../../test/custom-text";
import { getCurrentInput } from "../../../test/events/data";
import { getLiveCachedAccuracy } from "../../../test/events/live-cache";
import * as Focus from "../../../test/focus";
import * as LayoutfluidFunboxTimer from "../../../test/funbox/layoutfluid-funbox-timer";
import { findSingleActiveFunboxWithFunction } from "../../../test/funbox/list";
import * as PaceCaret from "../../../test/pace-caret";
import * as TestWords from "../../../test/test-words";
import {
  buildInitialWordMarkup,
  buildLiveWordMarkup,
} from "../../../test/word-markup";
import { cn } from "../../../utils/cn";
import {
  cancelPendingAnimationFramesStartingWith,
  requestDebouncedAnimationFrame,
} from "../../../utils/debounced-animation-frame";
import * as Misc from "../../../utils/misc";
import { convertRemToPixels } from "../../../utils/numbers";
import { isCoarsePointer } from "../../../utils/pointer";
import * as Strings from "../../../utils/strings";
import { getWordsFontScale, getWordsFontSize } from "../../../utils/words-font";
import * as MonkeyPower from "./MonkeyPower";

export const updateHintsPositionDebounced = Misc.debounceUntilResolved(
  updateHintsPosition,
  { rejectSkippedCalls: false },
);

export let activeWordTop = 0;
export let activeWordHeight = 0;
let wordTopBeforeLineJump = 0;
let lineTransition = false;

let currentTestLine = 0;

export function focusWords(force = false): void {
  if (force) {
    blurInputElement();
  }
  focusInputElement(true);
  if (isTestActive()) {
    keepWordsInputInTheCenter(true);
  } else {
    const typingTest = getTypingTestElement();
    scrollToCenterOrTop(typingTest);
  }
}

export function keepWordsInputInTheCenter(force = false): void {
  centerWordsInputEvent.dispatch(force);
}

export function updateActiveElement(
  options:
    | { direction: "forward" | "back"; initial?: undefined }
    | { direction?: undefined; initial: true },
): void {
  requestDebouncedAnimationFrame("test-ui.updateActiveElement", async () => {
    const { direction, initial } = options;

    let previousActiveWordTop: number | null = null;
    if (initial === undefined) {
      const previousActiveWord =
        getWordsEl().querySelector<HTMLElement>(".active");
      // in zen mode, because of the animation frame, previousActiveWord will be removed at this point, so check for null
      if (previousActiveWord !== null) {
        if (direction === "forward") {
          setClass(previousActiveWord, "typed", true);
          setWordJoining(previousActiveWord, true);
        } else if (direction === "back") {
          //
        }
        setClass(previousActiveWord, "active", false);
        previousActiveWordTop = previousActiveWord.offsetTop;
      }
    }

    const newActiveWord = getActiveWordElement();
    if (newActiveWord === null) {
      throw new Error("activeWord is null - can't update active element");
    }

    setClass(newActiveWord, "active", true);
    setClass(newActiveWord, "error", false);
    setClass(newActiveWord, "typed", false);
    setWordJoining(newActiveWord, false);

    activeWordTop = newActiveWord.offsetTop;
    activeWordHeight = newActiveWord.offsetHeight;

    if (previousActiveWordTop !== null) {
      const isTimedTest =
        Config.mode === "time" ||
        (Config.mode === "custom" && CustomText.getLimitMode() === "time") ||
        (Config.mode === "custom" && CustomText.getLimitValue() === 0);

      if (isTimedTest || !Config.showAllLines) {
        const newActiveWordTop = newActiveWord.offsetTop;
        if (newActiveWordTop > previousActiveWordTop) {
          await lineJump(previousActiveWordTop);
        }
      }
    }

    if (!initial && Config.tapeMode !== "off") {
      await scrollTape();
    }

    updateWordsInputPosition();
  });
}

function createHintsHtml(
  incorrectLettersIndices: number[][],
  activeWordLetters: HTMLElement[],
  input: string | string[],
  wrapWithDiv: boolean = true,
): string {
  // if input is an array, it contains only incorrect letters input.
  // if input is a string, it contains the whole word input.
  const isFullWord = typeof input === "string";
  const inputChars = isFullWord ? Strings.splitIntoCharacters(input) : input;

  let hintsHtml = "";
  let currentHint = 0;

  for (const adjacentLetters of incorrectLettersIndices) {
    for (const letterIndex of adjacentLetters) {
      const letter = activeWordLetters[letterIndex] as HTMLElement;
      const blockIndices = `${letterIndex}`;
      const blockChars = isFullWord
        ? inputChars[letterIndex]
        : inputChars[currentHint++];

      hintsHtml += `<hint data-chars-index=${blockIndices} style="left:${
        letter.offsetLeft + letter.offsetWidth / 2
      }px;">${blockChars}</hint>`;
    }
  }
  if (wrapWithDiv) hintsHtml = `<div class="hints">${hintsHtml}</div>`;
  return hintsHtml;
}

async function joinOverlappingHints(
  incorrectLettersIndices: number[][],
  activeWordLetters: HTMLElement[],
  hintElements: HTMLCollection,
): Promise<void> {
  const currentWord = TestWords.words.getCurrent();
  if (currentWord === undefined) return;

  const [isWordRightToLeft] = Strings.isWordRightToLeft(
    currentWord.text,
    isLanguageRightToLeft(),
    isDirectionReversed(),
  );

  let previousBlocksAdjacent = false;
  let currentHintBlock = 0;
  let HintBlocksCount = hintElements.length;
  while (currentHintBlock < HintBlocksCount - 1) {
    const hintBlock1 = hintElements[currentHintBlock] as HTMLElement;
    const hintBlock2 = hintElements[currentHintBlock + 1] as HTMLElement;

    const block1Indices = hintBlock1.dataset["charsIndex"]?.split(",") ?? [];
    const block2Indices = hintBlock2.dataset["charsIndex"]?.split(",") ?? [];

    const block1Letter1Indx = parseInt(block1Indices[0] ?? "0");
    const block2Letter1Indx = parseInt(block2Indices[0] ?? "0");

    const currentBlocksAdjacent = incorrectLettersIndices.some(
      (adjacentLettersSequence) =>
        adjacentLettersSequence.includes(block1Letter1Indx) &&
        adjacentLettersSequence.includes(block2Letter1Indx),
    );

    if (!currentBlocksAdjacent) {
      currentHintBlock++;
      previousBlocksAdjacent = false;
      continue;
    }

    const block1Letter1 = activeWordLetters[block1Letter1Indx] as HTMLElement;
    const block2Letter1 = activeWordLetters[block2Letter1Indx] as HTMLElement;

    const sameTop = block1Letter1.offsetTop === block2Letter1.offsetTop;

    const leftBlock = isWordRightToLeft ? hintBlock2 : hintBlock1;
    const rightBlock = isWordRightToLeft ? hintBlock1 : hintBlock2;

    // block edge is offset half its width because of transform: translate(-50%)
    const leftBlockEnds = leftBlock.offsetLeft + leftBlock.offsetWidth / 2;
    const rightBlockStarts = rightBlock.offsetLeft - rightBlock.offsetWidth / 2;

    if (sameTop && leftBlockEnds > rightBlockStarts) {
      // join hint blocks
      hintBlock1.dataset["charsIndex"] = [
        ...block1Indices,
        ...block2Indices,
      ].join(",");

      const block1Letter1Pos =
        block1Letter1.offsetLeft +
        (isWordRightToLeft ? block1Letter1.offsetWidth : 0);
      const bothBlocksLettersWidthHalved =
        hintBlock2.offsetLeft - hintBlock1.offsetLeft;
      hintBlock1.style.left = `${block1Letter1Pos + bothBlocksLettersWidthHalved}px`;

      hintBlock1.insertAdjacentHTML("beforeend", hintBlock2.innerHTML);
      hintBlock2.remove();

      // after joining blocks, the sequence is shorter
      HintBlocksCount--;
      // check if the newly formed block overlaps with the previous one
      if (previousBlocksAdjacent && currentHintBlock > 0) currentHintBlock--;
    } else {
      currentHintBlock++;
    }
    previousBlocksAdjacent = true;
  }
}

async function updateHintsPosition(): Promise<void> {
  if (
    getActivePage() !== "test" ||
    getResultVisible() ||
    (Config.indicateTypos !== "below" && Config.indicateTypos !== "both")
  ) {
    return;
  }

  let previousHintsContainer: HTMLElement | undefined;
  let hintIndices: number[][] = [];
  let hintText: string[] = [];

  const hintElements =
    getWordsEl().querySelectorAll<HTMLElement>(".hints > hint");

  for (const hintEl of hintElements) {
    const hintsContainer = hintEl.parentElement as HTMLElement;

    if (hintsContainer !== previousHintsContainer) {
      await adjustHintsContainer(previousHintsContainer, hintIndices, hintText);
      previousHintsContainer = hintsContainer;
      hintIndices = [];
      hintText = [];
    }

    const letterIndices = hintEl.dataset["charsIndex"]
      ?.split(",")
      .map((index) => parseInt(index));

    if (letterIndices === undefined || letterIndices.length === 0) continue;

    for (const currentLetterIndex of letterIndices) {
      const lastBlock = hintIndices[hintIndices.length - 1];
      if (lastBlock?.[lastBlock.length - 1] === currentLetterIndex - 1) {
        lastBlock.push(currentLetterIndex);
      } else {
        hintIndices.push([currentLetterIndex]);
      }
    }

    hintText.push(...Strings.splitIntoCharacters(hintEl.innerHTML));
  }
  await adjustHintsContainer(previousHintsContainer, hintIndices, hintText);

  async function adjustHintsContainer(
    hintsContainer: HTMLElement | undefined,
    hintIndices: number[][],
    hintText: string[],
  ): Promise<void> {
    if (!hintsContainer || hintIndices.length === 0) return;

    const wordElement = hintsContainer.parentElement as HTMLElement;
    const letterElements = Array.from(
      wordElement.querySelectorAll<HTMLElement>("letter"),
    );

    hintsContainer.innerHTML = createHintsHtml(
      hintIndices,
      letterElements,
      hintText,
      false,
    );
    const wordHintsElements = wordElement.getElementsByTagName("hint");
    await joinOverlappingHints(hintIndices, letterElements, wordHintsElements);
  }
}

function buildWordHTML(word: string, wordIndex: number): string {
  return buildInitialWordMarkup(
    word,
    wordIndex,
    findSingleActiveFunboxWithFunction("getWordHtml")?.functions.getWordHtml,
  );
}

function updateWordWrapperClasses(): void {
  // outoffocus applies transition, need to remove it
  setTestFocusState("focused");

  if (Config.tapeMode !== "off") {
    setClass(getWordsEl(), "tape", true);
    setClass(getWordsWrapperEl(), "tape", true);
  } else {
    setClass(getWordsEl(), "tape", false);
    setClass(getWordsWrapperEl(), "tape", false);
  }

  if (Config.blindMode) {
    setClass(getWordsEl(), "blind", true);
    setClass(getWordsWrapperEl(), "blind", true);
  } else {
    setClass(getWordsEl(), "blind", false);
    setClass(getWordsWrapperEl(), "blind", false);
  }

  if (Config.indicateTypos === "below" || Config.indicateTypos === "both") {
    setClass(getWordsEl(), "indicateTyposBelow", true);
    setClass(getWordsWrapperEl(), "indicateTyposBelow", true);
  } else {
    setClass(getWordsEl(), "indicateTyposBelow", false);
    setClass(getWordsWrapperEl(), "indicateTyposBelow", false);
  }

  if (Config.hideExtraLetters) {
    setClass(getWordsEl(), "hideExtraLetters", true);
    setClass(getWordsWrapperEl(), "hideExtraLetters", true);
  } else {
    setClass(getWordsEl(), "hideExtraLetters", false);
    setClass(getWordsWrapperEl(), "hideExtraLetters", false);
  }

  if (Config.flipTestColors) {
    setClass(getWordsEl(), "flipped", true);
  } else {
    setClass(getWordsEl(), "flipped", false);
  }

  if (Config.colorfulMode) {
    setClass(getWordsEl(), "colorfulMode", true);
  } else {
    setClass(getWordsEl(), "colorfulMode", false);
  }

  for (const element of [
    getCaretElement(),
    getPaceCaretElement(),
    getTypingTestElement(),
  ]) {
    element.style.fontSize = getWordsFontSize(Config.fontSize);
  }
  // under 16px ios zooms the page in when the input is focused
  getWordsInputElement().style.fontSize = `max(16px, ${getWordsFontSize(Config.fontSize)})`;

  if (isLanguageRightToLeft()) {
    setClass(getWordsEl(), "rightToLeftTest", true);
  } else {
    setClass(getWordsEl(), "rightToLeftTest", false);
  }
  setResultState("rightToLeft", isLanguageRightToLeft());

  const existing =
    getWordsEl()
      .className.split(/\s+/)
      .filter(
        (className) =>
          !className.startsWith("highlight-") &&
          !className.startsWith("typed-effect-"),
      ) ?? [];
  if (Config.highlightMode !== null) {
    existing.push(`highlight-${Config.highlightMode.replaceAll("_", "-")}`);
  }
  if (Config.typedEffect !== null) {
    existing.push(`typed-effect-${Config.typedEffect.replaceAll("_", "-")}`);
  }

  getWordsEl().className = existing.join(" ");

  updateWordsWidth();
  updateWordsWrapperHeight(true);
  if (!Config.showAllLines) {
    void centerActiveLine();
  }
  updateWordsMargin();
  updateWordsInputPosition();
  void updateHintsPositionDebounced();
  Caret.updatePosition(true);

  if (!isInputElementFocused()) {
    setTestFocusState("unfocused");
  }
}

function showWords(): void {
  getWordsEl().innerHTML = "";

  if (Config.mode === "zen") {
    appendEmptyWordElement(0);
  } else {
    let wordsHTML = "";
    for (let i = 0; i < TestWords.words.length; i++) {
      const word = TestWords.words.get(i);
      if (word === undefined) continue; // won't happen, but ts complains
      wordsHTML += buildWordHTML(word.display, i);
    }
    getWordsEl().innerHTML = wordsHTML;
  }

  updateActiveElement({
    initial: true,
  });
  updateWordWrapperClasses();
  PaceCaret.resetCaretPosition();
}

export function appendEmptyWordElement(index: number): void {
  getWordsEl().insertAdjacentHTML(
    "beforeend",
    `<div class='word' data-wordindex='${index}'><letter class='invisible'>_</letter></div>`,
  );
}

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
    convertRemToPixels(Config.fontSize) * getWordsFontScale();
  const targetTop =
    activeWord.offsetTop + letterHeight / 2 - el.offsetHeight / 2 + 1; //+1 for half of border

  const wordWidth = activeWord.offsetWidth;
  const left =
    Config.tapeMode !== "off"
      ? getWordsWrapperEl().offsetWidth * (Config.tapeMargin / 100)
      : wordWidth < letterHeight && isTestRightToLeft
        ? activeWord.offsetLeft - letterHeight
        : Math.max(0, activeWord.offsetLeft);

  // Publish one layout update so input styles settle before scrolling.
  setWordsInputStyle({
    "max-width": Config.tapeMode !== "off" ? `${100 - Config.tapeMargin}%` : "",
    width: `${Math.max(letterHeight, wordWidth)}px`,
    top: `${targetTop}px`,
    left: `${left}px`,
  });

  keepWordsInputInTheCenter();
}

let centeringActiveLine: Promise<void> = Promise.resolve();

export async function centerActiveLine(): Promise<void> {
  if (Config.showAllLines) {
    return;
  }

  const { resolve, promise } = Misc.promiseWithResolvers();
  centeringActiveLine = promise;

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

export function updateWordsWrapperHeight(force = false): void {
  if (getActivePage() !== "test" || getResultVisible()) return;
  if (!force && Config.mode !== "custom") return;
  const activeWordEl = getActiveWordElement();
  if (!activeWordEl) return;

  setWordsWrapperVisible(true);

  const wordComputedStyle = window.getComputedStyle(activeWordEl);
  const wordMargin =
    parseInt(wordComputedStyle.marginTop) +
    parseInt(wordComputedStyle.marginBottom);
  const wordHeight = activeWordEl.offsetHeight + wordMargin;

  const timedTest =
    Config.mode === "time" ||
    (Config.mode === "custom" && CustomText.getLimitMode() === "time") ||
    (Config.mode === "custom" && CustomText.getLimitValue() === 0);

  const showAllLines = Config.showAllLines && !timedTest;

  if (showAllLines) {
    //allow the wrapper to grow and shink with the words
    setWordsWrapperHeight("");
  } else if (Config.mode === "zen") {
    //zen mode, showAllLines off
    setWordsWrapperHeight(`${wordHeight * 2}px`);
  } else {
    if (Config.tapeMode === "off") {
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

function updateWordsMargin(): void {
  if (Config.tapeMode !== "off") {
    Object.assign(getWordsEl().style, { marginLeft: "0" });
    void scrollTape(true);
  } else {
    const afterNewlineEls = Array.from(
      getWordsEl().querySelectorAll<HTMLElement>(".afterNewline"),
    );
    Object.assign(getWordsEl().style, { marginLeft: "0", marginTop: "0" });
    for (const afterNewline of afterNewlineEls) {
      Object.assign(afterNewline.style, {
        marginLeft: "0",
      });
    }
  }
}

const appendFrames = new Set<number>();

export function addWord(
  word: string,
  wordIndex = TestWords.words.length - 1,
): void {
  // if the current active word is the last word, we need to NOT use raf
  // because other ui parts depend on the word existing
  if (getActiveWordIndex() === wordIndex - 1) {
    getWordsEl().insertAdjacentHTML(
      "beforeend",
      buildWordHTML(word, wordIndex),
    );
  } else {
    const frame = requestAnimationFrame(() => {
      appendFrames.delete(frame);
      getWordsEl().insertAdjacentHTML(
        "beforeend",
        buildWordHTML(word, wordIndex),
      );
    });
    appendFrames.add(frame);
  }

  // maybe ill come back to this
  // requestAnimationFrame(async () => {
  //   getWordsEl().insertAdjacentHTML("beforeend", buildWordHTML(word, wordIndex));
  //   // in case word addition took a long time and some input happened in the mean time
  //   // we need to update word letters for that word
  //   const inputHistory = [
  //     ...getInputHistory(),
  //     getCurrentInput(),
  //   ];
  //   const input = inputHistory[wordIndex];
  //   if (input !== undefined && input !== "") {
  //     await updateWordLetters({
  //       wordIndex,
  //       input,
  //       compositionData: CompositionState.getData(),
  //     });
  //   }
  // });
}

// because of the requestAnimationFrame, multiple calls to updateWordLetters
// can be made before the actual update happens. This map keeps track of the
// latest input for each word and is used in before-insert-text to
// make sure the currently typed word will not overflow to the next line
export let pendingWordData: Map<number, string> = new Map();

export async function updateWordLetters({
  wordIndex,
  input,
  compositionData,
}: {
  wordIndex: number;
  input: string;
  compositionData: string;
}): Promise<void> {
  pendingWordData.set(wordIndex, input);
  requestDebouncedAnimationFrame(
    `test-ui.updateWordLetters.${wordIndex}`,
    async () => {
      pendingWordData.delete(wordIndex);
      const currentWord = TestWords.words.get(wordIndex)?.display;
      if (currentWord === undefined && Config.mode !== "zen") return;
      const wordAtIndex = getWordElement(wordIndex);
      if (!wordAtIndex) return;
      const {
        html: ret,
        hintIndices,
        newlineafter,
      } = buildLiveWordMarkup({
        currentWord,
        input,
        compositionData,
        zen: Config.mode === "zen",
        indicateTypos: Config.indicateTypos,
        compositionDisplay: Config.compositionDisplay,
        getWordHtml:
          findSingleActiveFunboxWithFunction("getWordHtml")?.functions
            .getWordHtml,
      });

      wordAtIndex.innerHTML = ret;

      if (hintIndices?.length) {
        const wordAtIndexLetters = Array.from(
          wordAtIndex.querySelectorAll<HTMLElement>("letter"),
        );
        let hintsHtml;
        if (Config.indicateTypos === "both") {
          hintsHtml = createHintsHtml(
            hintIndices,
            wordAtIndexLetters,
            currentWord ?? "",
          );
        } else {
          hintsHtml = createHintsHtml(hintIndices, wordAtIndexLetters, input);
        }
        wordAtIndex.insertAdjacentHTML("beforeend", hintsHtml);
        const hintElements = wordAtIndex.getElementsByTagName("hint");
        await joinOverlappingHints(
          hintIndices,
          wordAtIndexLetters,
          hintElements,
        );
      }

      if (newlineafter) {
        wordAtIndex.insertAdjacentHTML(
          "afterend",
          "<div class='beforeNewline'></div><div class='newline'></div><div class='afterNewline'></div>",
        );
      }
      if (Config.tapeMode !== "off") {
        void scrollTape();
      }
      if (Config.mode === "zen" || SlowTimer.get()) {
        // because we block word jumps in before-insert-text
        // this check only needs to happen in zen mode
        // unless slow timer is on, then it needs to happen
        // because the word jump check is disabled
        if (!Config.showAllLines) {
          const wordTopAfterUpdate = wordAtIndex.offsetTop;
          if (wordTopAfterUpdate > activeWordTop) {
            let jump = false;
            if (!lineTransition) {
              wordTopBeforeLineJump = wordTopAfterUpdate;
              jump = true;
            } else if (wordTopAfterUpdate > wordTopBeforeLineJump) {
              jump = true;
            }
            if (jump) await lineJump(activeWordTop);
          }
        }
      }
    }, //end of raf
  );
}

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

  await centeringActiveLine;

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
  if (Config.tapeMode === "letter" && inputLength > 0) {
    const letters = Array.from(
      activeWordEl.querySelectorAll<HTMLElement>("letter"),
    );
    let lastPositiveLetterWidth = 0;
    for (let i = 0; i < inputLength; i++) {
      const letter = letters[i];
      if (
        (Config.blindMode || Config.hideExtraLetters) &&
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
  const tapeMarginPx = wordsWrapperWidth * (Config.tapeMargin / 100);
  let newMarginOffset = wordsWidthBeforeActive + currentWordWidth;
  let newMargin = tapeMarginPx - newMarginOffset;
  if (isTestRightToLeft) {
    newMarginOffset *= -1;
    newMargin = wordRightMargin - newMargin;
  }

  const duration = noAnimation ? 0 : 125;
  const ease = "inOut(1.25)";

  const caretScrollOptions = {
    newValue: newMarginOffset * -1,
    duration: Config.smoothLineScroll ? duration : 0,
    ease,
  };

  Caret.getCaret().handleTapeScroll(caretScrollOptions);
  PaceCaret.getCaret().handleTapeScroll(caretScrollOptions);

  if (Config.smoothLineScroll) {
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

let currentLinesJumping = 0;

async function lineJump(currentTop: number, force = false): Promise<void> {
  //last word of the line
  if (currentTestLine > 0 || force) {
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
      currentTestLine++;
      updateWordsWrapperHeight();
      return;
    }

    currentLinesJumping++;

    const wordHeight = outerHeight(activeWordEl);
    const newMarginTop = -1 * wordHeight * currentLinesJumping;
    const duration = 125;

    const caretLineJumpOptions = {
      newMarginTop,
      duration: Config.smoothLineScroll ? duration : 0,
    };
    Caret.getCaret().handleLineJump(caretLineJumpOptions);
    PaceCaret.getCaret().handleLineJump(caretLineJumpOptions);

    if (Config.smoothLineScroll) {
      lineTransition = true;
      await animateAsync(getWordsEl(), {
        marginTop: newMarginTop,
        duration,
      });
      currentLinesJumping = 0;
      activeWordTop = activeWordEl.offsetTop;
      activeWordHeight = activeWordEl.offsetHeight;
      removeTestElements(lastElementIndexToRemove);
      Object.assign(getWordsEl().style, { marginTop: "0" });
      lineTransition = false;
    } else {
      currentLinesJumping = 0;
      removeTestElements(lastElementIndexToRemove);
    }
  }
  currentTestLine++;
  updateWordsWrapperHeight();
  return;
}

export function setJoiningClass(isEnabled: boolean): void {
  const joiningScript =
    isEnabled || Config.mode === "custom" || Config.mode === "zen";
  if (joiningScript) {
    setClass(getWordsEl(), "joiningScript", true);
  } else {
    setClass(getWordsEl(), "joiningScript", false);
  }
  setResultState("joiningScript", joiningScript);
}

export function highlightBadWord(index: number): void {
  requestDebouncedAnimationFrame(`test-ui.highlightBadWord.${index}`, () => {
    setClass(getWordElement(index), "error", true);
  });
}

export function highlightAllLettersAsCorrect(wordIndex: number): void {
  requestDebouncedAnimationFrame(
    `test-ui.highlightAllLettersAsCorrect.${wordIndex}`,
    () => {
      const letters = Array.from(
        getWordElement(wordIndex)?.children ?? [],
      ) as HTMLElement[];
      for (const letter of letters ?? []) {
        setClass(letter, "correct", true);
      }
    },
  );
}

function updateWordsWidth(): void {
  let css: Record<string, string> = {};
  if (Config.tapeMode === "off") {
    if (Config.maxLineWidth === 0) {
      css = {
        "max-width": "100%",
      };
    } else {
      css = {
        "max-width": `${Config.maxLineWidth}ch`,
      };
    }
  } else {
    if (Config.maxLineWidth === 0) {
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
  if (Config.maxLineWidth === 0) {
    setClass(el, "full-width-padding", false);
    setClass(el, "content", true);
  } else {
    setClass(el, "content", false);
    setClass(el, "full-width-padding", true);
  }
}

export function getActiveWordTopAndHeightWithDifferentData(data: string): {
  top: number;
  height: number;
} {
  const activeWord = getActiveWordElement();

  if (!activeWord) throw new Error("No active word element found");

  const lettersEls = Array.from(
    activeWord.querySelectorAll<HTMLElement>("letter"),
  );
  const domLettersCount = lettersEls.length;
  const nodes = [];
  for (let i = domLettersCount; i < data.length; i++) {
    const tempLetter = document.createElement("letter");
    const displayData = data[i] === " " ? "_" : data[i];
    tempLetter.textContent = displayData as string;
    nodes.push(tempLetter);
  }

  lettersEls[domLettersCount - 1]?.after(...nodes);

  const top = activeWord.offsetTop;
  const height = activeWord.offsetHeight;
  for (const node of nodes) {
    node.remove();
  }

  return { top, height };
}

// this means input, delete or composition
function afterAnyTestInput(
  type: "textInput" | "delete" | "compositionUpdate",
  correctInput: boolean | null,
): void {
  if (type === "textInput" || type === "compositionUpdate") {
    if (
      correctInput === true ||
      Config.playSoundOnError === "off" ||
      Config.blindMode
    ) {
      void SoundController.playClick();
    } else {
      void SoundController.playError();
    }
  } else if (type === "delete") {
    void SoundController.playClick();
  }

  const acc = Numbers.roundTo2(getLiveCachedAccuracy());
  if (!isNaN(acc)) {
    setCurrentLiveStats({ acc });
  }

  if (Config.keymapMode === "next") {
    const keyToHighlight =
      TestWords.words.getCurrent()?.textWithCommit[getCurrentInput().length];
    if (keyToHighlight !== undefined) {
      highlight(keyToHighlight);
    }
  }

  Focus.set(true);
  Caret.stopAnimation();
  Caret.updatePosition();
}

export function afterTestTextInput(
  correct: boolean,
  inputOverride?: string,
  goingToNextWord = false,
): void {
  void MonkeyPower.addPower(correct);

  let input = inputOverride ?? getCurrentInput();
  if (goingToNextWord) {
    input = input.replace(/ $/, "");
  }

  void updateWordLetters({
    input,
    wordIndex: getActiveWordIndex(),
    compositionData: CompositionState.getData(),
  });

  afterAnyTestInput("textInput", correct);
}

export function afterTestCompositionUpdate(): void {
  void updateWordLetters({
    input: getCurrentInput(),
    wordIndex: getActiveWordIndex(),
    compositionData: CompositionState.getData(),
  });
  // correct needs to be true to get the normal click sound
  afterAnyTestInput("compositionUpdate", true);
}

export function afterTestDelete(): void {
  void updateWordLetters({
    input: getCurrentInput(),
    wordIndex: getActiveWordIndex(),
    compositionData: CompositionState.getData(),
  });
  afterAnyTestInput("delete", null);
}

export function beforeTestWordChange(
  direction: "forward",
  correct: boolean,
): void;
export function beforeTestWordChange(direction: "back", correct: null): void;
export function beforeTestWordChange(
  direction: "forward" | "back",
  correct: boolean | null,
): void {
  if (direction === "back") {
    void updateWordLetters({
      input: getCurrentInput(),
      wordIndex: getActiveWordIndex(),
      compositionData: CompositionState.getData(),
    });
  }

  if (direction === "forward") {
    if (Config.blindMode) {
      highlightAllLettersAsCorrect(getActiveWordIndex());
    } else if (correct === false) {
      highlightBadWord(getActiveWordIndex());
    }
  }
}

export async function afterTestWordChange(
  direction: "forward" | "back",
  lastBurst?: number | null,
): Promise<void> {
  updateActiveElement({
    direction,
  });
  Caret.updatePosition();

  if (lastBurst !== null && Numbers.isSafeNumber(lastBurst)) {
    setCurrentLiveStats({ burst: Math.round(lastBurst) });
  }

  if (Config.keymapMode === "next") {
    const keyToHighlight =
      TestWords.words.getCurrent()?.textWithCommit[getCurrentInput().length];
    if (keyToHighlight !== undefined) {
      highlight(keyToHighlight);
    }
  }

  if (direction === "forward") {
    //
  } else if (direction === "back") {
    if (Config.mode === "zen") {
      // because we need to delete newline, beforenewline and afternewline elements which dont have wordindex attributes
      // we need to do this loop thingy and delete all elements after the active word
      let deleteElements = false;
      for (const child of Array.from(
        getWordsEl().children ?? [],
      ) as HTMLElement[]) {
        if (deleteElements) {
          child.remove();
          continue;
        }
        const attr = child.getAttribute("data-wordindex");
        if (attr === null) continue;
        const wordIndex = parseInt(attr, 10);
        if (wordIndex === getActiveWordIndex()) {
          deleteElements = true;
        }
      }
    }
  }
}

export function onTestStart(): void {
  Focus.set(true);
  setCurrentLiveStats({
    wpm: 0,
    acc: 100,
    raw: 0,
    burst: 0,
    seconds: 0,
  });
}

function getRestartAnimationTime(noAnim: boolean): number {
  return noAnim ? 0 : Misc.applyReducedMotion(125);
}

export async function fadeOutForRestart(
  source: "testPage" | "resultPage",
  noAnim: boolean,
): Promise<void> {
  const el =
    source === "resultPage" ? getResultElement() : getTypingTestElement();
  await animateAsync(el, {
    opacity: 0,
    duration: getRestartAnimationTime(noAnim),
  });
}

export async function fadeInAfterRestart(noAnim: boolean): Promise<void> {
  const typingTestEl = getTypingTestElement();
  await animateAsync(typingTestEl, {
    opacity: [0, 1],
    onBegin: () => {
      setClass(typingTestEl, "hidden", false);
    },
    duration: getRestartAnimationTime(noAnim),
  });
}

export function onTestRestart(source: "testPage" | "resultPage"): void {
  setClass(getResultElement(), "hidden", true);
  Object.assign(getTypingTestElement().style, { opacity: "0" });
  setClass(getTypingTestElement(), "hidden", false);
  setWordsInputStyle((previous) => ({ ...previous, left: "0" }));
  Focus.set(false);
  setCurrentLiveStats({
    wpm: undefined,
    acc: undefined,
    raw: undefined,
    burst: undefined,
    seconds: undefined,
  });
  LayoutfluidFunboxTimer.instantHide();
  // force blur drops the keyboard on iOS (refocus without a gesture won't reopen it),
  // so on touch keep the input focused; value was already reset in test-logic restart.
  // without a keyboard up (first load), stay unfocused so the tap to type hint shows
  if (!isCoarsePointer()) {
    focusWords(true);
  } else if (isTouchKeyboardFocused()) {
    focusWords();
  } else {
    scrollToCenterOrTop(getTypingTestElement());
  }
  MonkeyPower.reset();
  Caret.resetPosition();
  setTestInitError(null);

  if (!ConnectionState.get()) {
    ConnectionState.showOfflineBanner();
  }

  if (source === "resultPage") {
    if (Config.randomTheme !== "off") {
      void ThemeController.randomizeTheme();
    }
    skipBreakdownEvent.dispatch();
  }

  currentTestLine = 0;
  if (Config.compositionDisplay === "below") {
    setCompositionText(" ");
  }
  void SoundController.clearAllSounds();
  cancelPendingAnimationFramesStartingWith("test-ui");
  showWords();
}

export function onTestFinish(): void {
  Caret.hide();
  setTestFocusState("focused");
  if (Config.playSoundOnClick === "16") {
    void SoundController.playFartReverb();
  }
}

function onWordsConfigChange({
  key,
  newValue,
}: Parameters<Parameters<typeof configEvent.subscribe>[0]>[0]): void {
  if (!areTestElementsMounted()) return;
  if (key === "showOutOfFocusWarning" && !newValue) {
    setTestFocusState("focused");
  }
  if (key === "compositionDisplay" && newValue === "below") {
    setCompositionText(" ");
  }
  if (
    ["fontSize", "fontFamily", "blindMode", "hideExtraLetters"].includes(
      key ?? "",
    )
  ) {
    void updateHintsPositionDebounced();
  }
  if (key === "highlightMode") {
    if (getActivePage() === "test") {
      void updateWordLetters({
        input: getCurrentInput(),
        wordIndex: getActiveWordIndex(),
        compositionData: CompositionState.getData(),
      });
    }
  }
  if (
    [
      "highlightMode",
      "typedEffect",
      "blindMode",
      "indicateTypos",
      "tapeMode",
      "hideExtraLetters",
      "flipTestColors",
      "colorfulMode",
      "showAllLines",
      "fontSize",
      "fontFamily",
      "maxLineWidth",
      "tapeMargin",
    ].includes(key)
  ) {
    if (key !== "fontFamily") updateWordWrapperClasses();
    if (["typedEffect", "fontFamily", "fontSize"].includes(key)) {
      updateWordJoining(key, getWordsEl());
    }
  }
}

// D1: Solid owns this container; letter updates and positioning stay imperative.
export function Words(props: {
  ref: (element: HTMLDivElement) => void;
}): JSXElement {
  let element!: HTMLDivElement;
  onMount(() => {
    createEffect(() =>
      setClass(element, "noErrorBorder", getBackground().url !== ""),
    );
    useWordsFocus(element);
    configEvent.useListener(onWordsConfigChange);
    onCleanup(() => {
      cancelPendingAnimationFramesStartingWith("test-ui");
      pendingWordData.clear();
      for (const frame of appendFrames) cancelAnimationFrame(frame);
      appendFrames.clear();
    });
  });
  return (
    <div
      id="words"
      ref={(el) => {
        element = el;
        props.ref(el);
      }}
      class={cn(
        "full-width flex h-fit w-full flex-wrap content-start pb-[0.5em] select-none",
      )}
    ></div>
  );
}

function canBreak(wordEl: HTMLElement): boolean {
  if (Config.typedEffect !== "dots") return false;
  if (wordEl.className.split(/\s+/).includes("broken-joining")) return false;

  return (
    wordEl.parentElement?.className.split(/\s+/).includes("joiningScript") ??
    false
  );
}

function applyIfNeeded(wordEl: HTMLElement): void {
  if (!canBreak(wordEl)) return;

  const letters = Array.from(wordEl.querySelectorAll<HTMLElement>("letter"));
  const firstTop = Math.floor(letters[0]?.offsetTop ?? 0);
  const isWrapped = letters.some((l) => Math.floor(l.offsetTop) !== firstTop);

  if (!isWrapped) {
    const { width } = wordEl.getBoundingClientRect();
    Object.assign(wordEl.style, { width: `${width}px` });
    setClass(wordEl, "needs-wrap", false);
  } else {
    Object.assign(wordEl.style, { width: "" });
    setClass(wordEl, "needs-wrap", true);
  }
  setClass(wordEl, "broken-joining", true);
}

function reset(wordEl: HTMLElement): void {
  if (!wordEl.className.split(/\s+/).includes("broken-joining")) return;
  setClass(wordEl, "broken-joining", false);
  setClass(wordEl, "needs-wrap", false);
  Object.assign(wordEl.style, { width: "" });
}

function setWordJoining(wordEl: HTMLElement, joiningBroken: boolean): void {
  joiningBroken ? applyIfNeeded(wordEl) : reset(wordEl);
}

function updateWordJoining(key: string, wordsEl: HTMLElement): void {
  const words = Array.from(
    wordsEl.querySelectorAll<HTMLElement>(".word.typed"),
  );

  const shouldReset =
    !wordsEl.className.split(/\s+/).includes("joiningScript") ||
    Config.typedEffect !== "dots" ||
    key === "fontFamily" ||
    key === "fontSize";

  if (shouldReset) {
    words.forEach(reset);
  }
  words.forEach(applyIfNeeded);
}

export function clearWords(): void {
  getWordsEl().replaceChildren();
}

export function clearWordsBlur(): void {
  setClass(getWordsEl(), "blurred", false);
}
