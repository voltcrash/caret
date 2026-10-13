import {
  updateActiveElement,
  showWords,
  updateWordLetters,
  highlightBadWord,
  highlightAllLettersAsCorrect,
  disposeWordRendering,
} from "./words/rendering";
export {
  updateActiveElement,
  appendEmptyWordElement,
  addWord,
  pendingWordData,
  updateWordLetters,
  highlightBadWord,
  highlightAllLettersAsCorrect,
  getActiveWordTopAndHeightWithDifferentData,
  clearWords,
  clearWordsBlur,
} from "./words/rendering";

import { updateWordWrapperClasses } from "./words/wrapper-classes";
export { scrollTape } from "./words/tape";

export { centerActiveLine } from "./words/line-jumping";
import { lineState } from "./words/line-state";
export { activeWordTop, activeWordHeight } from "./words/line-state";

export {
  updateWordsInputPosition,
  updateWordsWrapperHeight,
} from "./words/sizing";
import { updateWordJoining } from "./words/joining";
export { setJoiningClass } from "./words/joining";
import { updateHintsPositionDebounced } from "./words/hints";
export { updateHintsPositionDebounced } from "./words/hints";
import { focusWords } from "./words/focus";
export { focusWords, keepWordsInputInTheCenter } from "./words/focus";
import { scrollToCenterOrTop } from "./words/dimensions";
import { setClass } from "./words/elements";
export { getWordElement, getActiveWordElement } from "./words/elements";
import * as Numbers from "@oxytype/util/numbers";
import { createEffect, JSXElement, onCleanup, onMount } from "solid-js";

import { animateAsync } from "../../../anim";
import { Config } from "../../../config/store";
import * as SoundController from "../../../controllers/sound-controller";
import * as ThemeController from "../../../controllers/theme-controller";
import { configEvent } from "../../../events/config";
import { highlight } from "../../../events/keymap";
import { useWordsFocus } from "../../../hooks/useWordsFocus";
import { isTouchKeyboardFocused } from "../../../input/input-element";
import { getBackground } from "../../../states/background";
import * as CompositionState from "../../../states/composition";
import * as ConnectionState from "../../../states/connection";
import { getActivePage } from "../../../states/core";
import { skipBreakdownEvent } from "../../../states/header";
import { getResultElement } from "../../../states/result";
import {
  getActiveWordIndex,
  setCompositionText,
  setCurrentLiveStats,
  setTestFocusState,
  setTestInitError,
} from "../../../states/test";
import {
  areTestElementsMounted,
  getWordsElement as getWordsEl,
  getTypingTestElement,
} from "../../../states/test-dom";
import { setWordsInputStyle } from "../../../states/words-layout";
import * as Caret from "../../../test/caret";
import { getCurrentInput } from "../../../test/events/data";
import { getLiveCachedAccuracy } from "../../../test/events/live-cache";
import * as Focus from "../../../test/focus";
import * as LayoutfluidFunboxTimer from "../../../test/funbox/layoutfluid-funbox-timer";
import * as TestWords from "../../../test/test-words";
import { cn } from "../../../utils/cn";
import { cancelPendingAnimationFramesStartingWith } from "../../../utils/debounced-animation-frame";
import * as Misc from "../../../utils/misc";
import { isCoarsePointer } from "../../../utils/pointer";
import * as MonkeyPower from "./MonkeyPower";

// because of the requestAnimationFrame, multiple calls to updateWordLetters
// can be made before the actual update happens. This map keeps track of the
// latest input for each word and is used in before-insert-text to
// make sure the currently typed word will not overflow to the next line

// this is needed in tape mode because sometimes we want the newline character to appear above the next line
// and sometimes we want it to be shifted to the left
// (for example if the newline is typed incorrectly, or there are any extra letters after it)

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

  lineState.currentTestLine = 0;
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
      disposeWordRendering();
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
