import {
  Accessor,
  batch,
  createSignal,
  JSXElement,
  onCleanup,
  onMount,
} from "solid-js";

import { resultState, resultWordHighlightEvent } from "../states/result";
import { isLanguageRightToLeft } from "../states/test";
import { createEffectOn } from "./effects";
import { getHighlightElementPositions } from "./result-word-highlight/geometry";
import { measureWordLines } from "./result-word-highlight/measurement";
import {
  type Line,
  type HighlightPosition,
} from "./result-word-highlight/types";
import { ResultWordHighlight } from "./result-word-highlight/View";
const TOGGLE_RESULT_WORDS_BUFFER = 250;
export function useResultWordHighlight(
  wordsHistoryElement: Accessor<HTMLElement | undefined>,
): {
  component: () => JSXElement;
  destroy: () => void;
} {
  const [lines, setLines] = createSignal<Line[]>([]);
  const [positions, setPositions] = createSignal<HighlightPosition[]>([]);
  const [hidden, setHidden] = createSignal(true);
  const [animate, setAnimate] = createSignal(false);

  // collection of all word elements
  let wordEls: HTMLElement[] = [];
  // word index -> line index
  let wordIndexToLineIndexDict: Record<number, number> = {};
  let highlightContainerEls: HTMLElement[] = [];
  let inputWordsContainerEls: HTMLElement[] = [];
  // user inputs aligned with .word elements
  let inputWordEls: HTMLElement[] = [];
  // range of currently highlighted words
  let highlightRange: number[] = [];
  // last time the words history was toggled
  let lastToggleWordsHistoryTime = new Date();

  let isInitialized = false;
  let isHoveringChart = false;
  let isFirstHighlightSinceInit = true;
  let isFirstHighlightSinceClear = true;
  let isInitInProgress = false;

  // Highlights .word elements in range [firstWordIndex, lastWordIndex]
  async function highlightWordsInRange(
    firstWordIndex: number,
    lastWordIndex: number,
  ): Promise<boolean> {
    if (!isHoveringChart) {
      return false;
    }

    if (
      firstWordIndex === highlightRange?.[0] &&
      lastWordIndex === highlightRange[1]
    ) {
      return false;
    }

    if (!isInitialized) {
      // awaiting also lets the new highlight elements render
      const initResponse = await init();
      if (!initResponse) {
        return false;
      }
    }

    if (
      firstWordIndex === undefined ||
      lastWordIndex === undefined ||
      firstWordIndex < 0 ||
      lastWordIndex < 0 ||
      lastWordIndex < firstWordIndex
    ) {
      return false;
    }

    lastWordIndex = Math.min(lastWordIndex, wordEls.length - 1);

    const newPositions = getHighlightElementPositions(
      {
        lines: lines(),
        wordEls,
        wordIndexToLineIndexDict,
        highlightContainerEls,
        inputWordsContainerEls,
        inputWordEls,
      },
      firstWordIndex,
      lastWordIndex,
      isLanguageRightToLeft(),
    );

    batch(() => {
      setHidden(false);
      // make highlight appear instantly for first highlight
      setAnimate(!isFirstHighlightSinceInit && !isFirstHighlightSinceClear);
      setPositions(newPositions);
    });

    isFirstHighlightSinceInit = false;
    isFirstHighlightSinceClear = false;
    highlightRange = [firstWordIndex, lastWordIndex];
    return true;
  }

  function clear(): void {
    setHidden(true);
    isFirstHighlightSinceClear = true;
    highlightRange = [];
  }

  function destroy(): void {
    if (!isInitialized) return;

    batch(() => {
      setLines([]);
      setPositions([]);
      setHidden(true);
      setAnimate(false);
    });

    highlightContainerEls = [];
    wordIndexToLineIndexDict = {};
    inputWordsContainerEls = [];
    inputWordEls = [];
    isInitialized = false;
    isFirstHighlightSinceInit = true;
    isFirstHighlightSinceClear = true;
    highlightRange = [];
  }

  async function init(): Promise<boolean> {
    if (isInitialized || isInitInProgress) {
      return false;
    }

    isInitInProgress = true;

    // wait for the words history to finish sliding before measuring
    const TIME_DIFF_SINCE_LAST_TOGGLE =
      new Date().getTime() - lastToggleWordsHistoryTime.getTime();
    if (TIME_DIFF_SINCE_LAST_TOGGLE < TOGGLE_RESULT_WORDS_BUFFER) {
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          TOGGLE_RESULT_WORDS_BUFFER - TIME_DIFF_SINCE_LAST_TOGGLE,
        ),
      );
    }

    const RWH_el = wordsHistoryElement();
    if (RWH_el === undefined) {
      isInitInProgress = false;
      return false;
    }
    const measured = measureWordLines(RWH_el, isLanguageRightToLeft());
    if (measured === undefined) {
      isInitInProgress = false;
      return false;
    }
    wordEls = measured.wordEls;
    wordIndexToLineIndexDict = measured.wordIndexToLineIndexDict;
    setLines(measured.lines);

    isInitialized = true;
    isInitInProgress = false;
    return true;
  }

  resultWordHighlightEvent.useListener((event) => {
    if (event.type === "highlight") {
      void highlightWordsInRange(event.firstWordIndex, event.lastWordIndex);
    } else {
      isHoveringChart = event.hovering;
      if (!event.hovering) clear();
    }
  });

  createEffectOn(
    () => resultState.wordsHistory.visible,
    () => {
      lastToggleWordsHistoryTime = new Date();
    },
    { defer: true },
  );

  // new result, measured words are gone
  createEffectOn(() => resultState.wordsHistory.items, destroy, {
    defer: true,
  });

  onMount(() => {
    addEventListener("resize", destroy);
  });
  onCleanup(() => {
    removeEventListener("resize", destroy);
  });

  function component(): JSXElement {
    return (
      <ResultWordHighlight
        lines={lines}
        positions={positions}
        hidden={hidden}
        animate={animate}
        onHighlightContainer={(index, el) => {
          highlightContainerEls[index] = el;
        }}
        onInputWordsContainer={(index, el) => {
          inputWordsContainerEls[index] = el;
        }}
        onInputWord={(index, el) => {
          inputWordEls[index] = el;
        }}
      />
    );
  }

  return { component, destroy };
}
