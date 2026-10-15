import * as TestWords from "./test-words";
import { testSession } from "./events/data";
import { Config } from "../config/store";
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
    Config.paceCaretStyle,
  ));
}

export function setLastTestWpm(wpm: number): void {
  testSession.pace.rememberWpm(wpm, isPaceRepeat());
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
  clearTimeout(timeout);
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
    const { getActiveTagsPB } = await import("../collections/tags");
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
    const { getUserAverage10Once } = await import("../collections/results");
    wpm = Math.round((await getUserAverage10Once({ ...Config, mode2 })).wpm);
  } else if (Config.paceCaret === "daily") {
    const { getUserDailyBestOnce } = await import("../collections/results");
    wpm = Math.round((await getUserDailyBestOnce({ ...Config, mode2 })).wpm);
  } else if (Config.paceCaret === "custom") {
    wpm = Config.paceCaretCustomSpeed;
  } else if (Config.paceCaret === "last" || isPaceRepeat()) {
    wpm = testSession.pace.getLastWpm();
  }
  setPaceCaretWpm(testSession.pace.reset(wpm) ? wpm : undefined);
}

function update(): void {
  if (!testSession.pace.isEnabled() || !isTestActive() || getResultVisible()) {
    return;
  }

  if (getCaret().isHidden()) {
    getCaret().show();
  }

  const position = testSession.pace.step(
    (index) => TestWords.words.get(index)?.text,
    Config.blindMode,
  );
  if (position === null) {
    getCaret().hide();
    return;
  }

  try {
    const duration = testSession.pace.getStepEnd() - performance.now();

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
  testSession.pace.reset();
}

export function handleSpace(correct: boolean, currentWord: string): void {
  testSession.pace.correct(
    getActiveWordIndex(),
    correct,
    currentWord,
    Config.blindMode,
  );
}

export function start(): void {
  testSession.pace.start(performance.now());
  update();
}

configEvent.subscribe(
  ({ key }) => {
    if (!areTestElementsMounted()) return;
    if (key === "paceCaret") void init();
  },
  import.meta.hot,
);
