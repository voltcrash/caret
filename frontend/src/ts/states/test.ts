import { createAppMemo, createAppOwned } from "../../app/application";
import { createAppSignal } from "../../app/state";
import { onCleanup } from "solid-js";
import { getConfig } from "../config/store";
import { EventLog } from "@caret/web-shared/events/types";

import { CompletedEvent } from "@caret/schemas/results";

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

export const [isLongTest, setIsLongTest] = createAppSignal(false);
export const [getLastResult, setLastResult] = createAppSignal<Omit<
  CompletedEvent,
  "hash" | "uid"
> | null>(null);

export const [getCurrentQuote, setCurrentQuote] =
  createAppSignal<QuoteWithTextSplit | null>(null);

export const [getLastSignedOutResult, setLastSignedOutResult] =
  createAppSignal<CompletedEvent | null>(null);

export const [getLastEventLog, setLastEventLog] =
  createAppSignal<EventLog | null>(null);
