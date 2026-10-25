import { captureTypingRoute, isTypingRouteActive } from "../scope";
import { createAppOwned } from "../../../app/application";
import { onCleanup } from "solid-js";
import * as TestUI from "./test-ui";
import * as Strings from "../../../ts/utils/strings";

import * as JSONData from "../../../ts/utils/json-data";
import * as Numbers from "@oxytype/util/numbers";
import { showNoticeNotification } from "../../../ts/states/notifications";
import * as CustomText from "./custom-text";
import * as PractiseWords from "./practise-words";
import * as Funbox from "./funbox/funbox";
import * as PaceCaret from "./pace-caret";
import * as TestTimer from "./test-timer";

import * as Replay from "./replay";

import { clearQuoteStats } from "../../../ts/states/quote-rate";

import {
  getCustomTextIndicator,
  isAuthenticated,
} from "../../../ts/states/core";
import {
  setKoreanStatus,
  setIsTestRestarting,
  isTestRestarting,
  isPaceRepeat,
  isTestActive,
  pushIncompleteTest,
  setIsPaceRepeat,
  setIsRepeated,
  setIsTestInvalid,
  isResultCalculating,
  setBailedOut,
  setResultVisible,
  setTestActive,
  getResultVisible,
} from "../../../ts/states/test";
import { restartTestEvent } from "../../../ts/events/test";
import * as TestWords from "./test-words";
import { configEvent } from "../../../ts/events/config";
import * as AnalyticsController from "../../../ts/controllers/analytics-controller";
import { preloadResultHasher } from "../../../ts/utils/result-hash";

import { highlight } from "../../../ts/events/keymap";
import * as LazyModeState from "../../../ts/states/remember-lazy-mode";

import { getActiveFunboxesWithFunction } from "./funbox/list";

import * as CompositionState from "../../../ts/states/composition";

import { setInputElementValue } from "../../../ts/input/input-element";
import { debounce } from "@oxytype/util/timing";

import { getMutableConfig } from "../../../ts/config/store";
import { setConfig } from "../../../ts/config/setters";
import { getTestSession, resetTestEvents } from "./events/data";

import { resetModifierState } from "../../../ts/states/modifiers";
import { nthElementFromArray } from "../../../ts/utils/arrays";

import { testLogicState } from "./logic-state";
import { init } from "./initialization";
import { finish } from "./completion";
export { finish } from "./completion";
export async function retrySavingResult(): Promise<void> {
  const saving = await import("./result-saving");
  await saving.retrySavingResult();
}
export function startTest(now: number): boolean {
  if (!isTypingRouteActive()) {
    return false;
  }

  if (isAuthenticated()) {
    void AnalyticsController.log("testStarted");
    // warm the hasher so saving the result only waits on the request
    void preloadResultHasher().catch(() => undefined);
  } else {
    void AnalyticsController.log("testStartedNoLogin");
  }

  setTestActive(true);
  TestTimer.clear();
  getTestSession().start(now);

  for (const fb of getActiveFunboxesWithFunction("start")) {
    fb.functions.start();
  }

  try {
    if (
      getMutableConfig().paceCaret !== "off" ||
      (getMutableConfig().repeatedPace && isPaceRepeat())
    ) {
      PaceCaret.start();
    }
  } catch (e) {}
  TestTimer.start(now);
  TestUI.onTestStart();
  return true;
}

type RestartOptions = {
  withSameWordset?: boolean;
  nosave?: boolean;
  event?: KeyboardEvent;
  practiseMissed?: boolean;
  noAnim?: boolean;
  isQuickRestart?: boolean;
};

export async function restart(options = {} as RestartOptions): Promise<void> {
  const lease = captureTypingRoute();
  if (!lease.isCurrent()) return;
  const defaultOptions = {
    withSameWordset: false,
    practiseMissed: false,
    noAnim: false,
    nosave: false,
    isQuickRestart: false,
  };

  options = { ...defaultOptions, ...options };

  // guards

  const session = getTestSession();
  const decision = session.isPrepared()
    ? session.restartPolicy({
        quick: options.isQuickRestart ?? false,
        withSameWordset: options.withSameWordset ?? false,
        customIsLong: getCustomTextIndicator()?.isLong ?? false,
      })
    : undefined;
  if (decision?.reason === "noQuit") {
    showNoticeNotification(
      "No quit funbox is active. Please finish the test.",
      {
        important: true,
      },
    );
    options.event?.preventDefault();
    return;
  }

  if (isTestRestarting() || isResultCalculating()) {
    options.event?.preventDefault();
    return;
  }
  if (isTestActive()) {
    if (options.isQuickRestart) {
      if (decision?.preventDefault) options.event?.preventDefault();
      if (decision?.reason === "longTest") {
        let message = "Use your mouse to confirm.";
        if (getMutableConfig().quickRestart === "tab") {
          message = "Press shift + tab or use your mouse to confirm.";
        } else if (getMutableConfig().quickRestart === "esc") {
          message = "Press shift + escape or use your mouse to confirm.";
        } else if (getMutableConfig().quickRestart === "enter") {
          message = "Press shift + enter or use your mouse to confirm.";
        }
        showNoticeNotification(
          `Quick restart disabled in long tests. ${message}`,
          {
            durationMs: 4000,
            important: true,
          },
        );
        return;
      }
    }

    // close out the abandoned test

    if (decision?.recordIncomplete) {
      // Abandoning logs the timer "end" event before measuring, so idle time
      // is subtracted instead of the whole wall-clock lifetime.
      TestTimer.clear();
      const { acc, seconds } = getTestSession().abandon(performance.now());
      pushIncompleteTest({ acc: Numbers.roundTo2(acc), seconds });
    }
  }

  if (decision !== undefined) {
    options.withSameWordset = decision.withSameWordset;
  }

  if (
    PractiseWords.before.mode !== null &&
    !options.withSameWordset &&
    !options.practiseMissed
  ) {
    showNoticeNotification("Reverting to previous settings.");
    if (PractiseWords.before.punctuation !== null) {
      setConfig("punctuation", PractiseWords.before.punctuation);
    }
    if (PractiseWords.before.numbers !== null) {
      setConfig("numbers", PractiseWords.before.numbers);
    }

    if (PractiseWords.before.customText) {
      CustomText.setText(PractiseWords.before.customText.text);
      CustomText.setLimitMode(PractiseWords.before.customText.limit.mode);
      CustomText.setLimitValue(PractiseWords.before.customText.limit.value);
      CustomText.setPipeDelimiter(
        PractiseWords.before.customText.pipeDelimiter,
      );
    }

    setConfig("mode", PractiseWords.before.mode);
    PractiseWords.resetBefore();
  }

  // reset state

  resetTestEvents();
  TestTimer.clear();
  setIsTestInvalid(false);
  resetModifierState();
  setTestActive(false);
  Replay.pauseReplay();
  setBailedOut(false);
  PaceCaret.reset();
  setKoreanStatus(false);
  clearQuoteStats();
  CompositionState.setComposing(false);
  CompositionState.setData("");
  Strings.clearWordDirectionCache();
  testLogicState.testReinitCount = 0;

  const repeatWithPace = decision?.repeatWithPace ?? false;
  setIsRepeated(options.withSameWordset ?? false);
  setIsPaceRepeat(repeatWithPace);

  // restart

  const source: "testPage" | "resultPage" = getResultVisible()
    ? "resultPage"
    : "testPage";
  const noAnim = options.noAnim ?? false;

  setIsTestRestarting(true);

  await TestUI.fadeOutForRestart(source, noAnim);
  if (!lease.isCurrent()) return;

  setResultVisible(false);
  setInputElementValue("");

  await Funbox.rememberSettings();
  if (!lease.isCurrent()) return;

  const initResult = await init();
  if (!lease.isCurrent()) return;

  if (!initResult) {
    setIsTestRestarting(false);
    return;
  }

  await PaceCaret.init();
  if (!lease.isCurrent()) return;

  for (const fb of getActiveFunboxesWithFunction("restart")) {
    fb.functions.restart();
  }

  TestUI.onTestRestart(source);

  await TestUI.fadeInAfterRestart(noAnim);
  if (!lease.isCurrent()) return;
  setIsTestRestarting(false);
}

export function fail(reason: string): void {
  getTestSession().finish(performance.now(), reason);
}

const zipfCheck = createAppOwned(() => {
  const check = debounce(250, async () => {
    const lease = captureTypingRoute();
    const supports = await JSONData.checkIfLanguageSupportsZipf(
      getMutableConfig().language,
    );
    if (!lease.isCurrent()) return;
    if (supports === "no") {
      showNoticeNotification(
        `${Strings.capitalizeFirstLetter(
          Strings.getLanguageDisplayString(getMutableConfig().language),
        )} does not support Zipf funbox, because the list is not ordered by frequency. Please try another word list.`,
        {
          durationMs: 7000,
        },
      );
    }
    if (supports === "unknown") {
      showNoticeNotification(
        `${Strings.capitalizeFirstLetter(
          Strings.getLanguageDisplayString(getMutableConfig().language),
        )} may not support Zipf funbox, because we don't know if it's ordered by frequency or not. If you would like to add this label, please contact us.`,
        {
          durationMs: 7000,
        },
      );
    }
  });
  onCleanup(() => check.cancel());
  return check;
});

// ===============================

// Time limits, timer failures and fail() all end the session first.
export function useTestLogicEvents(): void {
  onCleanup(
    getTestSession().on("finish", ({ reason }) => {
      void finish(reason !== undefined);
    }),
  );

  restartTestEvent.useListener((event) => void restart(event));
  configEvent.useListener(({ key, newValue, nosave }) => {
    if (isTypingRouteActive()) {
      if (key === "language") {
        //automatically enable lazy mode for arabic
        if (
          (newValue as string)?.startsWith("arabic") &&
          LazyModeState.getArabicPref()
        ) {
          setConfig("lazyMode", true, {
            nosave: true,
          });
        }
        void restart();
      }
      if (key === "difficulty" && !nosave) void restart();
      if (
        key === "customLayoutfluid" &&
        getMutableConfig().funbox.includes("layoutfluid")
      ) {
        void restart();
      }

      if (
        key === "keymapMode" &&
        newValue === "next" &&
        getMutableConfig().mode !== "zen"
      ) {
        setTimeout(() => {
          highlight(
            nthElementFromArray(
              Array.from(TestWords.words.getCurrent()?.text ?? ""),
              0,
            ) as string,
          );
        }, 0);
      }
      if (
        (key === "language" || key === "funbox") &&
        getMutableConfig().funbox.includes("zipf")
      ) {
        zipfCheck()();
      }
    }
    if (key === "lazyMode" && !nosave) {
      if (getMutableConfig().language.startsWith("arabic")) {
        LazyModeState.setArabicPref(newValue);
      }
    }
  });
}
