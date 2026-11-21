import { createAppOwned } from "../../app/application";
import { createAppSignal } from "../../app/state";
import { onCleanup } from "solid-js";

import { CompletedEvent } from "@caret/schemas/results";

import { createAppSignalWithSetters } from "../hooks/createSignalWithSetters";
import { QuoteWithTextSplit } from "@caret/web-shared/quotes";
import { clearTimeouts } from "../utils/misc";

// Test state that shared code reads. Typing-only state lives in
// features/typing/state (enforced by shared-test-state.spec.ts).
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

export const [getFocus, setFocus] = createAppSignal(false);
// Words blur, composition display and OutOfFocusWarning share delayed input focus.
const focusTimeouts = createAppOwned(() => {
  const timers: (number | NodeJS.Timeout)[] = [];
  onCleanup(() => clearTimeouts(timers));
  return timers;
});
type TestFocusState = "focused" | "unfocused" | "unfocusedWindow";
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

export const [isLongTest, setIsLongTest] = createAppSignal(false);

export const [getCurrentQuote, setCurrentQuote] =
  createAppSignal<QuoteWithTextSplit | null>(null);

export const [getLastSignedOutResult, setLastSignedOutResult] =
  createAppSignal<CompletedEvent | null>(null);
