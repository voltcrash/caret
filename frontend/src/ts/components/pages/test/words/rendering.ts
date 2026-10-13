import { scrollTape } from "./tape";
import { updateWordWrapperClasses } from "./wrapper-classes";
import { lineJump } from "./line-jumping";
import {
  activeWordTop,
  lineState,
  updateActiveWordGeometry,
} from "./line-state";
import { updateWordsInputPosition } from "./sizing";
import { setWordJoining } from "./joining";
import { createHintsHtml, joinOverlappingHints } from "./hints";
import { getWordElement, getActiveWordElement, setClass } from "./elements";
import { Config } from "../../../../config/store";
import * as SlowTimer from "../../../../states/slow-timer";
import { getActiveWordIndex } from "../../../../states/test";
import { getWordsElement as getWordsEl } from "../../../../states/test-dom";
import * as CustomText from "../../../../test/custom-text";
import { findSingleActiveFunboxWithFunction } from "../../../../test/funbox/list";
import * as PaceCaret from "../../../../test/pace-caret";
import * as TestWords from "../../../../test/test-words";
import {
  buildInitialWordMarkup,
  buildLiveWordMarkup,
} from "../../../../test/word-markup";
import { requestDebouncedAnimationFrame } from "../../../../utils/debounced-animation-frame";

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

    updateActiveWordGeometry(newActiveWord);

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

function buildWordHTML(word: string, wordIndex: number): string {
  return buildInitialWordMarkup(
    word,
    wordIndex,
    findSingleActiveFunboxWithFunction("getWordHtml")?.functions.getWordHtml,
  );
}

export function showWords(): void {
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
            if (!lineState.lineTransition) {
              lineState.wordTopBeforeLineJump = wordTopAfterUpdate;
              jump = true;
            } else if (wordTopAfterUpdate > lineState.wordTopBeforeLineJump) {
              jump = true;
            }
            if (jump) await lineJump(activeWordTop);
          }
        }
      }
    }, //end of raf
  );
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

export function clearWords(): void {
  getWordsEl().replaceChildren();
}

export function clearWordsBlur(): void {
  setClass(getWordsEl(), "blurred", false);
}

export function disposeWordRendering(): void {
  pendingWordData.clear();
  for (const frame of appendFrames) cancelAnimationFrame(frame);
  appendFrames.clear();
}
