import { createAppMemo, createAppOwned } from "../../app/application";
import { createAppStore, createAppSignal, appSignal } from "../../app/state";
import { onCleanup } from "solid-js";
import { z } from "zod";
import { getConfig } from "../config/store";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { EventLog } from "@caret/web-shared/events/types";

import type { Challenge } from "@caret/challenges";
import { CompletedEvent, IncompleteTest } from "@caret/schemas/results";

import { createAppSignalWithSetters } from "../hooks/createSignalWithSetters";
import { QuoteWithTextSplit } from "@caret/web-shared/quotes";
import { clearTimeouts } from "../utils/misc";
export {
  isTestActive,
  isTestRestarting,
  isResultCalculating,
  isResultLoading,
  getResultVisible,
  getTestInitError,
} from "./test-lifecycle/controller";

export const [wordsHaveNewline, setWordsHaveNewline] = createAppSignal(false);
export const [wordsHaveTab, setWordsHaveTab] = createAppSignal(false);
export const [wordsHaveNumbers, setWordsHaveNumbers] = createAppSignal(false);

export const [getLoadedChallenge, setLoadedChallenge] =
  createAppSignal<Challenge | null>(null);
// Set when the user bails out of a test early; reset by TestLogic.restart().
export const [getBailedOut, setBailedOut] = createAppSignal(false);
export const [getFocus, setFocus] = createAppSignal(false);
// Words blur, composition display and OutOfFocusWarning share delayed input focus.
const focusTimeouts = createAppOwned(() => {
  const timers: (number | NodeJS.Timeout)[] = [];
  onCleanup(() => clearTimeouts(timers));
  return timers;
});
export type TestFocusState = "focused" | "unfocused" | "unfocusedWindow";
export const [testFocusState, { setTestFocusState }] =
  createAppSignalWithSetters<TestFocusState>("focused")({
    setTestFocusState: (set, val: TestFocusState) => {
      if (val === "focused") {
        clearTimeouts(focusTimeouts());
        set(val);
      } else {
        clearTimeouts(focusTimeouts());
        focusTimeouts().push(
          setTimeout(() => {
            set(val);
          }, 1000),
        );
      }
    },
  });

export const showOutOfFocusWarning = createAppMemo(
  () => getConfig.showOutOfFocusWarning && testFocusState() !== "focused",
);

// max-height of the warning, kept in sync with the words wrapper by test-ui.
export const [outOfFocusMaxHeight, setOutOfFocusMaxHeight] = createAppSignal<
  number | undefined
>(undefined);

export const [isTestInvalid, setIsTestInvalid] = createAppSignal(false);
export const [isLongTest, setIsLongTest] = createAppSignal(false);
export const [getLastResult, setLastResult] = createAppSignal<Omit<
  CompletedEvent,
  "hash" | "uid"
> | null>(null);
export const [
  getIncompleteTests,
  { push: pushIncompleteTest, reset: resetIncompleteTests },
] = createAppSignalWithSetters<IncompleteTest[]>([])({
  push: (set, val: IncompleteTest) => set((arr) => [...arr, val]),
  reset: (set) => set([]),
});
export const getRestartCount = createAppMemo(() => getIncompleteTests().length);
export const getIncompleteSeconds = createAppMemo(() =>
  getIncompleteTests().reduce((sum, test) => sum + test.seconds, 0),
);

export const [isRepeated, setIsRepeated] = createAppSignal(false);
export const [isPaceRepeat, setIsPaceRepeat] = createAppSignal(false);
export const [getPaceCaretWpm, setPaceCaretWpm] = createAppSignal<
  number | undefined
>(undefined);
export const [getCurrentQuote, setCurrentQuote] =
  createAppSignal<QuoteWithTextSplit | null>(null);

export const [getLastSignedOutResult, setLastSignedOutResult] =
  createAppSignal<CompletedEvent | null>(null);

export const [
  getActiveWordIndex,
  {
    increase: increaseActiveWordIndex,
    decrease: decreaseActiveWordIndex,
    reset: resetActiveWordIndex,
    fromEngine: setActiveWordIndex,
  },
] = createAppSignalWithSetters<number>(0)({
  increase: (set) => set((n) => n + 1),
  decrease: (set) => set((n) => n - 1),
  reset: (set) => set(0),
  fromEngine: (set, index: number) => set(index),
});

/**
 * Live test stats, rendered by the Solid live stat displays (the mini and text
 * variants and the progress bar). The test engine is still vanilla, so it pushes
 * plain numbers in here as it goes; everything shown on screen is derived below.
 * `undefined` means "no data yet" and is what the displays fall back to defaults on.
 */
export const [currentLiveStats, setCurrentLiveStats] = createAppStore<{
  wpm?: number;
  acc?: number;
  raw?: number;
  burst?: number;
  seconds?: number;
}>({});

export const [getSelectedQuoteId, setSelectedQuoteId] = appSignal(() =>
  useLocalStorage({
    key: "selectedQuoteId",
    schema: z.number().int().min(1),
    fallback: 1,
  }),
);

export const [isLanguageRightToLeft, setIsLanguageRightToLeft] =
  createAppSignal(false);
export const [isDirectionReversed, setIsDirectionReversed] =
  createAppSignal(false);
export const [getLastEventLog, setLastEventLog] =
  createAppSignal<EventLog | null>(null);
