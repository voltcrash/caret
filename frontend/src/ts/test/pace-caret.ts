import * as TestWords from "./test-words";
import { getTestSession } from "./events/data";
import { getMutableConfig } from "../config/store";
import * as DB from "../db";
import * as Misc from "../utils/misc";
import { configEvent } from "../events/config";
import { getActiveFunboxes } from "./funbox/list";
import { CaretController } from "../components/pages/test/words/caret-controller";
import {
  areTestElementsMounted,
  getPaceCaretElement,
} from "../states/test-dom";
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

// The session owns pace state; this module schedules steps and renders them.
let timeout: NodeJS.Timeout | undefined;

let caret: CaretController | undefined;

// The Caret component creates and disposes the controller.
export function setCaret(controller: CaretController): () => void {
  caret = controller;
  return () => {
    if (caret === controller) caret = undefined;
  };
}

export function getCaret(): CaretController {
  return (caret ??= new CaretController(
    getPaceCaretElement(),
    getMutableConfig().paceCaretStyle,
  ));
}

export function setLastTestWpm(wpm: number): void {
  getTestSession().pace.rememberWpm(wpm, isPaceRepeat());
}

export function resetCaretPosition(): void {
  if (getMutableConfig().paceCaret === "off" && !isPaceRepeat()) return;
  if (getMutableConfig().mode === "zen") return;

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
  clearTimeout(timeout);
  getCaret().hide();
  const mode2 = Misc.getMode2(getMutableConfig(), getCurrentQuote());
  let wpm = 0;
  if (getMutableConfig().paceCaret === "pb") {
    wpm =
      DB.getLocalPB(
        getMutableConfig().mode,
        mode2,
        getMutableConfig().punctuation,
        getMutableConfig().numbers,
        getMutableConfig().language,
        getMutableConfig().difficulty,
        getMutableConfig().lazyMode,
        getActiveFunboxes(),
      )?.wpm ?? 0;
  } else if (getMutableConfig().paceCaret === "tagPb") {
    const { getActiveTagsPB } = await import("../collections/tags");
    wpm = getActiveTagsPB(
      getMutableConfig().mode,
      mode2,
      getMutableConfig().punctuation,
      getMutableConfig().numbers,
      getMutableConfig().language,
      getMutableConfig().difficulty,
      getMutableConfig().lazyMode,
    );
  } else if (getMutableConfig().paceCaret === "average") {
    const { getUserAverage10Once } = await import("../collections/results");
    wpm = Math.round(
      (await getUserAverage10Once({ ...getMutableConfig(), mode2 })).wpm,
    );
  } else if (getMutableConfig().paceCaret === "daily") {
    const { getUserDailyBestOnce } = await import("../collections/results");
    wpm = Math.round(
      (await getUserDailyBestOnce({ ...getMutableConfig(), mode2 })).wpm,
    );
  } else if (getMutableConfig().paceCaret === "custom") {
    wpm = getMutableConfig().paceCaretCustomSpeed;
  } else if (getMutableConfig().paceCaret === "last" || isPaceRepeat()) {
    wpm = getTestSession().pace.getLastWpm();
  }
  setPaceCaretWpm(getTestSession().pace.reset(wpm) ? wpm : undefined);
}

function update(): void {
  if (
    !getTestSession().pace.isEnabled() ||
    !isTestActive() ||
    getResultVisible()
  ) {
    return;
  }

  if (getCaret().isHidden()) {
    getCaret().show();
  }

  const position = getTestSession().pace.step(
    (index) => TestWords.words.get(index)?.text,
    getMutableConfig().blindMode,
  );
  if (position === null) {
    getCaret().hide();
    return;
  }

  try {
    const duration = getTestSession().pace.getStepEnd() - performance.now();

    getCaret().goTo({
      wordIndex: position.wordIndex,
      letterIndex: position.letterIndex,
      isLanguageRightToLeft: isLanguageRightToLeft(),
      isDirectionReversed: isDirectionReversed(),
      animate: true,
      animationOptions: {
        duration,
        easing: "linear",
      },
    });

    timeout = setTimeout(update, Math.max(0, duration));
  } catch (e) {
    console.error(e);
    getCaret().hide();
  }
}

export function reset(): void {
  clearTimeout(timeout);
  getTestSession().pace.reset();
}

export function handleSpace(correct: boolean, currentWord: string): void {
  getTestSession().pace.correct(
    getActiveWordIndex(),
    correct,
    currentWord,
    getMutableConfig().blindMode,
  );
}

export function start(): void {
  getTestSession().pace.start(performance.now());
  update();
}

export function usePaceCaretEvents(): void {
  configEvent.useListener(({ key }) => {
    if (!areTestElementsMounted()) return;
    if (key === "paceCaret") void init();
  });
}
