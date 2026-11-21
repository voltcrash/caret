import { isStartupFinished } from "#app/startup.ts";
import { createAppOwned } from "#app/application.ts";
import { onCleanup } from "solid-js";
import { captureTypingRoute } from "../scope";
import { getTestSession } from "./events/data";
import { peekConfig } from "#shared/config/store.ts";
import * as DB from "#shared/db.ts";
import * as Misc from "#shared/utils/misc.ts";
import { configEvent } from "#shared/events/config.ts";
import { getActiveFunboxes } from "./funbox/list";
import { CaretController } from "../components/words/caret-controller";
import {
  areTestElementsMounted,
  getPaceCaretElement,
} from "#shared/states/test-dom.ts";
import {
  isDirectionReversed,
  isLanguageRightToLeft,
  getCurrentQuote,
  getResultVisible,
  isTestActive,
} from "#shared/states/test.ts";
import {
  isPaceRepeat,
  setPaceCaretWpm,
} from "#features/typing/state/repeat.ts";

// The session owns pace state; this module schedules steps and renders them.
const state = createAppOwned(() => {
  const value: {
    timeout?: ReturnType<typeof setTimeout>;
    caret?: CaretController;
  } = {};
  onCleanup(() => {
    clearTimeout(value.timeout);
    value.caret?.stopAllAnimations();
  });
  return value;
});

// The Caret component creates and disposes the controller.
export function setCaret(controller: CaretController): () => void {
  state().caret = controller;
  return () => {
    if (state().caret === controller) state().caret = undefined;
  };
}

export function getCaret(): CaretController {
  return (state().caret ??= new CaretController(
    getPaceCaretElement(),
    peekConfig().paceCaretStyle,
  ));
}

export function setLastTestWpm(wpm: number): void {
  getTestSession().pace.rememberWpm(wpm, isPaceRepeat());
}

export function resetCaretPosition(): void {
  if (peekConfig().paceCaret === "off" && !isPaceRepeat()) return;
  if (peekConfig().mode === "zen") return;

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

export async function init(lease = captureTypingRoute()): Promise<void> {
  if (!lease.isCurrent()) return;
  clearTimeout(state().timeout);
  getCaret().hide();
  // Account-derived pace is optional on the first test. Later restarts use
  // the settled account data; never download history to reveal the page.
  if (
    !isStartupFinished() &&
    ["tagPb", "average", "daily"].includes(peekConfig().paceCaret)
  ) {
    setPaceCaretWpm(undefined);
    return;
  }
  const mode2 = Misc.getMode2(peekConfig(), getCurrentQuote());
  let wpm = 0;
  if (peekConfig().paceCaret === "pb") {
    wpm =
      DB.getLocalPB(
        peekConfig().mode,
        mode2,
        peekConfig().punctuation,
        peekConfig().numbers,
        peekConfig().language,
        peekConfig().difficulty,
        peekConfig().lazyMode,
        getActiveFunboxes(),
      )?.wpm ?? 0;
  } else if (peekConfig().paceCaret === "tagPb") {
    const { getActiveTagsPB } = await import("../../../data/collections/tags");
    if (!lease.isCurrent()) return;
    wpm = getActiveTagsPB(
      peekConfig().mode,
      mode2,
      peekConfig().punctuation,
      peekConfig().numbers,
      peekConfig().language,
      peekConfig().difficulty,
      peekConfig().lazyMode,
    );
  } else if (peekConfig().paceCaret === "average") {
    const { getUserAverage10Once } =
      await import("../../../data/collections/results");
    wpm = Math.round(
      (await getUserAverage10Once({ ...peekConfig(), mode2 })).wpm,
    );
  } else if (peekConfig().paceCaret === "daily") {
    const { getUserDailyBestOnce } =
      await import("../../../data/collections/results");
    wpm = Math.round(
      (await getUserDailyBestOnce({ ...peekConfig(), mode2 })).wpm,
    );
  } else if (peekConfig().paceCaret === "custom") {
    wpm = peekConfig().paceCaretCustomSpeed;
  } else if (peekConfig().paceCaret === "last" || isPaceRepeat()) {
    wpm = getTestSession().pace.getLastWpm();
  }
  if (!lease.isCurrent()) return;
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

  const position = getTestSession().pace.step();
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

    state().timeout = setTimeout(update, Math.max(0, duration));
  } catch (e) {
    console.error(e);
    getCaret().hide();
  }
}

export function reset(): void {
  clearTimeout(state().timeout);
  getTestSession().pace.reset();
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
