import { createAppMemo } from "../../app/application";

import * as LiveStats from "@oxytype/typing-core/live-stats";
import { getConfig } from "../config/store";
import Format from "../singletons/format";
import * as CustomText from "../test/custom-text";
import * as TestWords from "../test/test-words";
import {
  currentLiveStats,
  getActiveWordIndex,
  getBailedOut,
  getCurrentQuote,
  getFocus,
  isResultCalculating,
  isTestActive,
} from "./test";

function getCustomLimit(): LiveStats.CustomLimit {
  return {
    mode: CustomText.getLimitMode(),
    value: CustomText.getLimitValue(),
  };
}

/** Whether this test counts down a time limit rather than a number of words. */
function isTimeLimitedTest(): boolean {
  return LiveStats.isTimeLimitedTest(getConfig.mode, getCustomLimit());
}

/** Seconds the test counts down from. Only meaningful when {@link isTimeLimitedTest}. */
function getTestTimeLimit(): number {
  return LiveStats.getTestTimeLimit(getConfig, getCustomLimit());
}

/**
 * Words completed so far. Derived from the activeWordIndex signal, so it must be
 * read inside a computation — never snapshotted into the store, since the input
 * handlers advance the index *after* the live stat updates run.
 */
function getCurrentWordCount(): number {
  return LiveStats.getCurrentWordCount({
    mode: getConfig.mode,
    customLimit: getCustomLimit(),
    activeWordIndex: getActiveWordIndex(),
    getSectionIndex: () =>
      TestWords.words.get(getActiveWordIndex())?.sectionIndex,
  });
}

function getWordsTotal(): number {
  return LiveStats.getWordsTotal({
    config: getConfig,
    customLimit: getCustomLimit(),
    quoteLength: getCurrentQuote()?.textSplit.length,
    wordsLength: TestWords.words.length,
  });
}

export function getBarTarget(): {
  width: string;
  duration: number;
  ease?: string;
} {
  if (isTimeLimitedTest()) {
    const { seconds } = currentLiveStats;
    const limit = getTestTimeLimit();
    if (seconds === undefined || limit === 0) {
      return { width: "100vw", duration: 0 };
    }
    return {
      width: `${100 - ((seconds + 1) / limit) * 100}vw`,
      duration: 1000,
      ease: "linear",
    };
  }
  const wordsTotal = getWordsTotal();
  // no elapsed time means the test was reset, so snap back instead of animating
  if (currentLiveStats.seconds === undefined || wordsTotal === 0) {
    return { width: "0vw", duration: 0 };
  }
  // the active word index stops on the last word instead of going one past it,
  // so the word count alone tops out at (n-1)/n — fill the bar on finish.
  // isResultCalculating flips on the first line of finish(); getResultVisible
  // would be a fade-out too late, since the bar outlives the words fading out.
  if (isResultCalculating() && !getBailedOut()) {
    return { width: "100vw", duration: 125 };
  }
  return {
    width: `${Math.floor((getCurrentWordCount() / wordsTotal) * 100)}vw`,
    duration: 250,
  };
}

export const showLiveStats = createAppMemo(() => isTestActive() && getFocus());
export const getLiveSpeedText = createAppMemo(() =>
  LiveStats.getLiveSpeedText(Format, getConfig.blindMode, currentLiveStats),
);
export const getLiveAccText = createAppMemo(() =>
  LiveStats.getLiveAccText(getConfig.blindMode, currentLiveStats),
);
export const getLiveBurstText = createAppMemo(() =>
  LiveStats.getLiveBurstText(Format, currentLiveStats),
);

/** Countdown / word counter shown by the timer displays. */
export const getTimerText = createAppMemo(() =>
  LiveStats.getTimerText({
    config: getConfig,
    customLimit: getCustomLimit(),
    seconds: currentLiveStats.seconds,
    // read the signal first so the memo subscribes to it on every branch
    activeWordIndex: getActiveWordIndex(),
    wordCount: getCurrentWordCount(),
    wordsTotal: getWordsTotal(),
  }),
);
/**
 * The flash timer styles only reveal the time every 15 seconds. Only the flash
 * styles hide, and only on time limited tests — a word counter is always shown.
 */
export const isTimerFlashHidden = createAppMemo(() =>
  LiveStats.isTimerFlashHidden(
    getConfig,
    getCustomLimit(),
    currentLiveStats.seconds,
  ),
);
