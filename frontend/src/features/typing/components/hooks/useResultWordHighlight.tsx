import {
  Accessor,
  batch,
  createSignal,
  JSXElement,
  onCleanup,
  onMount,
} from "solid-js";

import { createEffectOn } from "../../../../ts/hooks/effects";
import { getHighlightElementPositions } from "../../../../ts/hooks/result-word-highlight/geometry";
import { measureWordLines } from "../../../../ts/hooks/result-word-highlight/measurement";
import {
  type Line,
  type HighlightPosition,
} from "../../../../ts/hooks/result-word-highlight/types";
import { ResultWordHighlight } from "../../../../ts/hooks/result-word-highlight/View";
import { isLanguageRightToLeft } from "../../../../ts/states/test";
import { resultState, resultWordHighlightEvent } from "../../state/result";
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

  let measurement: "idle" | "measuring" | "ready" = "idle";
  let revision = 0;
  let isHoveringChart = false;

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

    const generation = revision;
    if (measurement !== "ready") {
      // awaiting also lets the new highlight elements render
      const initResponse = await init();
      if (!initResponse || generation !== revision || !isHoveringChart) {
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
      setAnimate(highlightRange.length > 0);
      setPositions(newPositions);
    });

    highlightRange = [firstWordIndex, lastWordIndex];
    return true;
  }

  function clear(): void {
    setHidden(true);
    highlightRange = [];
  }

  function destroy(): void {
    revision++;
    measurement = "idle";

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
    highlightRange = [];
  }

  async function init(): Promise<boolean> {
    if (measurement !== "idle") {
      return false;
    }

    measurement = "measuring";
    const generation = revision;

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

    if (generation !== revision) return false;
    const RWH_el = wordsHistoryElement();
    if (RWH_el === undefined) {
      measurement = "idle";
      return false;
    }
    const measured = measureWordLines(RWH_el, isLanguageRightToLeft());
    if (measured === undefined) {
      measurement = "idle";
      return false;
    }
    wordEls = measured.wordEls;
    wordIndexToLineIndexDict = measured.wordIndexToLineIndexDict;
    setLines(measured.lines);

    measurement = "ready";
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
    revision++;
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
