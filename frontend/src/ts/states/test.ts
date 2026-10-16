import { createAppMemo, createAppOwned } from "../../app/application";
import { createAppStore, createAppSignal, appSignal } from "../../app/state";
import { createEffect, onCleanup } from "solid-js";
import { z } from "zod";
import { getConfig } from "../config/store";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { EventLog } from "@oxytype/typing-core/events/types";

import type { Challenge } from "@oxytype/challenges";
import { LayoutObject } from "@oxytype/schemas/layouts";
import { CompletedEvent, IncompleteTest } from "@oxytype/schemas/results";

import { keymapEvent } from "../events/keymap";
import { createAppSignalWithSetters } from "../hooks/createSignalWithSetters";
import * as CustomText from "../../features/typing/runtime/custom-text";
import { QuoteWithTextSplit } from "@oxytype/typing-core/quotes";
import { getLayout } from "../utils/json-data";
import { mirrorLayoutKeys } from "../utils/key-converter";
import { canQuickRestart } from "../utils/quick-restart";
import { replaceUnderscoresWithSpaces } from "../utils/strings";
import { getCustomTextIndicator } from "./core";
import { useResourceWithPromise } from "../hooks/useResourceWithPromise";
import { clearTimeouts } from "../utils/misc";

export const [wordsHaveNewline, setWordsHaveNewline] = createAppSignal(false);
export const [wordsHaveTab, setWordsHaveTab] = createAppSignal(false);
export const [wordsHaveNumbers, setWordsHaveNumbers] = createAppSignal(false);

export const [getLoadedChallenge, setLoadedChallenge] =
  createAppSignal<Challenge | null>(null);
export const [getResultVisible, setResultVisible] = createAppSignal(false);
// True from the first line of TestLogic.finish() until the result is built, so
// it covers the words fade-out that getResultVisible() is still false during.
export const [isResultCalculating, setResultCalculating] =
  createAppSignal(false);
// Spinner between the typing test fading out and the result showing.
export const [isResultLoading, setResultLoading] = createAppSignal(false);
// Set when the user bails out of a test early; reset by TestLogic.restart().
export const [getBailedOut, setBailedOut] = createAppSignal(false);
// Set when test init fails repeatedly; message is the last init error, if any.
export const [getTestInitError, setTestInitError] = createAppSignal<{
  message: string | undefined;
} | null>(null);
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

// live IME composition text, pushed from the compositionupdate/end events.
export const [getCompositionText, setCompositionText] = createAppSignal("");
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

export const [isTestActive, setTestActive] = createAppSignal(false);

export const [
  getActiveWordIndex,
  {
    increase: increaseActiveWordIndex,
    decrease: decreaseActiveWordIndex,
    reset: resetActiveWordIndex,
  },
] = createAppSignalWithSetters<number>(0)({
  increase: (set) => set((n) => n + 1),
  decrease: (set) => set((n) => n - 1),
  reset: (set) => set(0),
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

export const initializeTypingState = createAppOwned(() =>
  createEffect(() => {
    setIsLongTest(
      !canQuickRestart(
        getConfig.mode,
        getConfig.words,
        getConfig.time,
        CustomText.getData(),
        getCustomTextIndicator()?.isLong ?? false,
      ),
    );
  }),
);

export const getKeymapLayout = createAppMemo<{
  layout: string;
  layoutNameDisplayString: string;
  isMirrored: boolean;
}>(() => {
  const isOverride = getConfig.keymapLayout === "overrideSync";
  const raw = isOverride ? getConfig.layout : getConfig.keymapLayout;

  const layout = raw === "default" ? "qwerty" : raw;
  const layoutNameDisplayString = replaceUnderscoresWithSpaces(raw);
  const isMirrored = getConfig.funbox.includes("layout_mirror");

  return { layout: layout, layoutNameDisplayString, isMirrored };
});

const [getKeymapHighlightKey, setKeymapHighlightKey] = createAppSignal<
  string | undefined
>(undefined);

export { getKeymapHighlightKey };

export type FlashEntry = { tick: number; correct: boolean };

const [getKeymapFlashState, setKeymapFlashState] = createAppStore<
  Record<string, FlashEntry | undefined>
>({});

export { getKeymapFlashState, setKeymapFlashState };

export function useKeymapEvents(): void {
  keymapEvent.useListener(({ mode, key, correct }) => {
    const mappedKey = key === "" ? " " : key;
    setKeymapHighlightKey(mode === "highlight" ? mappedKey : undefined);

    if (mode === "flash" && getConfig.keymapMode === "react") {
      const existing = getKeymapFlashState[mappedKey];
      setKeymapFlashState(mappedKey, {
        tick: existing ? existing.tick + 1 : 1,
        correct: correct ?? true,
      });
    }
  });
}

const getInputLayout = createAppMemo<{
  layout: string;
  isMirrored: boolean;
}>(() => {
  return {
    layout: getConfig.layout === "default" ? "qwerty" : getConfig.layout,
    isMirrored: getConfig.funbox.includes("layout_mirror"),
  };
});

const inputLayout = createAppOwned(() =>
  useResourceWithPromise(getInputLayout, async (layout) => {
    const result = await getLayout(layout.layout);
    if (layout.isMirrored) {
      return mirrorLayoutKeys(result);
    }
    return result;
  }),
);

const keymapLayout = createAppOwned(() =>
  useResourceWithPromise(getKeymapLayout, async (layout) => {
    const result = await getLayout(layout.layout);
    if (layout.isMirrored) {
      return mirrorLayoutKeys(result);
    }
    return result;
  }),
);
const inputLayoutObject = (): LayoutObject | undefined => inputLayout()[0]();
export const keymapLayoutObject = (): LayoutObject | undefined =>
  keymapLayout()[0]();

/** Resolves once the current keymap layout has loaded. */
export async function waitForKeymapLayout(): Promise<LayoutObject> {
  await keymapLayout()[1].promise;
  const result = keymapLayoutObject();
  if (result === undefined) {
    throw new Error("Failed to load keymap layout");
  }
  return result;
}

/** Resolves once the current input layout has loaded. */
export async function waitForInputLayout(): Promise<LayoutObject> {
  await inputLayout()[1].promise;
  const result = inputLayoutObject();
  if (result === undefined) {
    throw new Error("Failed to load input layout");
  }
  return result;
}

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
export const [isTestRestarting, setIsTestRestarting] = createAppSignal(false);
export const [getKoreanStatus, setKoreanStatus] = createAppSignal(false);
export const [getLastEventLog, setLastEventLog] =
  createAppSignal<EventLog | null>(null);
