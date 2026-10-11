import {
  advancePace,
  correctPace,
  createPaceState,
  PaceState,
} from "@oxytype/typing-core/pace-caret";
import { cancelPendingAnimationFrame } from "../utils/debounced-animation-frame";
import * as TestWords from "./test-words";
import { Config } from "../config/store";
import * as DB from "../db";
import { getActiveTagsPB } from "../collections/tags";
import * as Misc from "../utils/misc";
import { configEvent } from "../events/config";
import { getActiveFunboxes } from "./funbox/list";
import { Caret } from "../elements/caret";
import {
  areTestElementsMounted,
  getPaceCaretElement,
} from "../states/test-dom";
import {
  getUserAverage10Once,
  getUserDailyBestOnce,
} from "../collections/results";
import {
  isDirectionReversed,
  isLanguageRightToLeft,
  getActiveWordIndex,
  getCurrentQuote,
  getResultVisible,
  isPaceRepeat,
  isTestActive,
  setPaceCaretWpm,
} from "../states/test";

type Settings = PaceState & { timeout: NodeJS.Timeout | null };

let startTimestamp = 0;

let settings: Settings | null = null;

let caret: Caret | undefined;

// The component owns the node and cancels its animations on disposal.
export function bindCaret(element: HTMLDivElement): () => void {
  const instance = new Caret(element, Config.paceCaretStyle);
  caret = instance;
  return () => {
    instance.stopAllAnimations();
    cancelPendingAnimationFrame(`caret.${element.id}.goTo`);
    if (caret === instance) caret = undefined;
  };
}

export function getCaret(): Caret {
  return (caret ??= new Caret(getPaceCaretElement(), Config.paceCaretStyle));
}

let lastTestWpm = 0;

export function setLastTestWpm(wpm: number): void {
  if (!isPaceRepeat() || (isPaceRepeat() && wpm > lastTestWpm)) {
    lastTestWpm = wpm;
  }
}

export function resetCaretPosition(): void {
  if (Config.paceCaret === "off" && !isPaceRepeat()) return;
  if (Config.mode === "zen") return;

  getCaret().hide();
  getCaret().stopAllAnimations();
  getCaret().clearMargins();

  getCaret().goTo({
    wordIndex: 0,
    letterIndex: 0,
    isLanguageRightToLeft: isLanguageRightToLeft(),
    isDirectionReversed: isDirectionReversed(),
    animate: false,
  });
}

export async function init(): Promise<void> {
  getCaret().hide();
  const mode2 = Misc.getMode2(Config, getCurrentQuote());
  let wpm = 0;
  if (Config.paceCaret === "pb") {
    wpm =
      DB.getLocalPB(
        Config.mode,
        mode2,
        Config.punctuation,
        Config.numbers,
        Config.language,
        Config.difficulty,
        Config.lazyMode,
        getActiveFunboxes(),
      )?.wpm ?? 0;
  } else if (Config.paceCaret === "tagPb") {
    wpm = getActiveTagsPB(
      Config.mode,
      mode2,
      Config.punctuation,
      Config.numbers,
      Config.language,
      Config.difficulty,
      Config.lazyMode,
    );
  } else if (Config.paceCaret === "average") {
    wpm = Math.round((await getUserAverage10Once({ ...Config, mode2 })).wpm);
  } else if (Config.paceCaret === "daily") {
    wpm = Math.round((await getUserDailyBestOnce({ ...Config, mode2 })).wpm);
  } else if (Config.paceCaret === "custom") {
    wpm = Config.paceCaretCustomSpeed;
  } else if (Config.paceCaret === "last" || isPaceRepeat()) {
    wpm = lastTestWpm;
  }
  if (wpm === undefined || wpm < 1 || Number.isNaN(wpm)) {
    settings = null;
    setPaceCaretWpm(undefined);
    return;
  }

  settings = { ...(createPaceState(wpm) as PaceState), timeout: null };
  setPaceCaretWpm(wpm);
}

async function update(expectedStepEnd: number): Promise<void> {
  const currentSettings = settings;
  if (currentSettings === null || !isTestActive() || getResultVisible()) {
    return;
  }

  if (getCaret().isHidden()) {
    getCaret().show();
  }

  incrementLetterIndex();

  try {
    const now = performance.now();
    const absoluteStepEnd = startTimestamp + expectedStepEnd;
    const duration = absoluteStepEnd - now;

    getCaret().goTo({
      wordIndex: currentSettings.currentWordIndex,
      letterIndex: currentSettings.currentLetterIndex,
      isLanguageRightToLeft: isLanguageRightToLeft(),
      isDirectionReversed: isDirectionReversed(),
      animate: true,
      animationOptions: {
        duration,
        easing: "linear",
      },
    });

    currentSettings.timeout = setTimeout(
      () => {
        if (settings !== currentSettings) return;
        update(expectedStepEnd + (currentSettings.spc ?? 0) * 1000).catch(
          () => {
            if (settings === currentSettings) settings = null;
          },
        );
      },
      Math.max(0, duration),
    );
  } catch (e) {
    console.error(e);
    getCaret().hide();
    return;
  }
}

export function reset(): void {
  if (settings?.timeout !== null && settings?.timeout !== undefined) {
    clearTimeout(settings.timeout);
  }
  settings = null;
  startTimestamp = 0;
}

function incrementLetterIndex(): void {
  if (settings === null) return;
  if (
    !advancePace(
      settings,
      (index) => TestWords.words.get(index)?.text,
      Config.blindMode,
    )
  ) {
    settings = null;
    getCaret().hide();
  }
}
export function handleSpace(correct: boolean, currentWord: string): void {
  correctPace(
    settings,
    getActiveWordIndex(),
    correct,
    currentWord,
    Config.blindMode,
  );
}

export function start(): void {
  const now = performance.now();
  startTimestamp = now;
  void update((settings?.spc ?? 0) * 1000);
}

configEvent.subscribe(
  ({ key }) => {
    if (!areTestElementsMounted()) return;
    if (key === "paceCaret") void init();
    if (key === "paceCaretStyle") {
      getCaret().setStyle(Config.paceCaretStyle);
    }
  },
  import.meta.hot,
);
