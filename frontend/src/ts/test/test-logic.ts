import { captureApplication, createAppOwned } from "../../app/application";
import { onCleanup } from "solid-js";
import * as TestUI from "./test-ui";
import * as Strings from "../utils/strings";

import * as JSONData from "../utils/json-data";
import * as Numbers from "@oxytype/util/numbers";
import {
  showNoticeNotification,
  showErrorNotification,
} from "../states/notifications";
import * as CustomText from "./custom-text";
import * as PractiseWords from "./practise-words";
import * as Funbox from "./funbox/funbox";
import * as PaceCaret from "./pace-caret";
import * as TestTimer from "./test-timer";

import * as Replay from "./replay";

import { clearQuoteStats } from "../states/quote-rate";

import {
  getActivePage,
  getCustomTextIndicator,
  isAuthenticated,
} from "../states/core";
import {
  setKoreanStatus,
  setIsTestRestarting,
  isTestRestarting,
  getCurrentQuote,
  isPaceRepeat,
  isRepeated,
  isTestActive,
  pushIncompleteTest,
  setIsPaceRepeat,
  setIsRepeated,
  setIsTestInvalid,
  getActiveWordIndex,
  isResultCalculating,
  setBailedOut,
  setResultVisible,
  setTestActive,
  getResultVisible,
} from "../states/test";
import { restartTestEvent } from "../events/test";
import * as TestWords from "./test-words";
import * as WordsGenerator from "./words-generator";
import * as PageTransition from "../states/page-transition";
import { configEvent } from "../events/config";
import * as AnalyticsController from "../controllers/analytics-controller";
import { preloadResultHasher } from "../utils/result-hash";

import { highlight } from "../events/keymap";
import * as LazyModeState from "../states/remember-lazy-mode";

import {
  findSingleActiveFunboxWithFunction,
  getActiveFunboxes,
  getActiveFunboxesWithFunction,
  isFunboxActive,
} from "./funbox/list";

import * as CompositionState from "../states/composition";

import { canQuickRestart } from "../utils/quick-restart";
import { setInputElementValue } from "../input/input-element";
import { debounce } from "throttle-debounce";

import { getMutableConfig } from "../config/store";
import { toggleFunbox, setConfig } from "../config/setters";
import { getTestSession, resetTestEvents } from "./events/data";

import { resetModifierState } from "../states/modifiers";
import { nthElementFromArray } from "../utils/arrays";

import { shouldRepeatQuote } from "@oxytype/typing-core/restart";

import { testLogicState } from "./logic-state";
import { init } from "./initialization";
import { finish } from "./completion";
export { finish } from "./completion";
export { retrySavingResult } from "./result-saving";
export function startTest(now: number): boolean {
  if (PageTransition.get()) {
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
  const defaultOptions = {
    withSameWordset: false,
    practiseMissed: false,
    noAnim: false,
    nosave: false,
    isQuickRestart: false,
  };

  options = { ...defaultOptions, ...options };

  // guards

  const noQuit = isFunboxActive("no_quit");
  if (isTestActive() && noQuit) {
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
      if (getMutableConfig().mode !== "zen") options.event?.preventDefault();
      if (
        !canQuickRestart(
          getMutableConfig().mode,
          getMutableConfig().words,
          getMutableConfig().time,
          CustomText.getData(),
          getCustomTextIndicator()?.isLong ?? false,
        )
      ) {
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

    if (isRepeated()) {
      options.withSameWordset = true;
    }

    if (getMutableConfig().resultSaving) {
      // Abandoning logs the timer "end" event before measuring, so idle time
      // is subtracted instead of the whole wall-clock lifetime.
      TestTimer.clear();
      const { acc, seconds } = getTestSession().abandon(performance.now());
      pushIncompleteTest({ acc: Numbers.roundTo2(acc), seconds });
    }
  }

  const currentQuote = getCurrentQuote();
  if (
    shouldRepeatQuote(getMutableConfig()) &&
    currentQuote !== null &&
    getMutableConfig().language.startsWith(currentQuote.language) &&
    (isTestActive() || getTestSession().getFinishReason() !== undefined)
  ) {
    options.withSameWordset = true;
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

  const repeatWithPace =
    (getMutableConfig().repeatedPace && options.withSameWordset) ?? false;
  setIsRepeated(options.withSameWordset ?? false);
  setIsPaceRepeat(repeatWithPace);

  // restart

  const source: "testPage" | "resultPage" = getResultVisible()
    ? "resultPage"
    : "testPage";
  const noAnim = options.noAnim ?? false;

  setIsTestRestarting(true);

  await TestUI.fadeOutForRestart(source, noAnim);

  setResultVisible(false);
  setInputElementValue("");

  await Funbox.rememberSettings();

  const initResult = await init();

  if (!initResult) {
    setIsTestRestarting(false);
    return;
  }

  await PaceCaret.init();

  for (const fb of getActiveFunboxesWithFunction("restart")) {
    fb.functions.restart();
  }

  TestUI.onTestRestart(source);

  await TestUI.fadeInAfterRestart(noAnim);
  setIsTestRestarting(false);
}

//add word during the test
export async function addWord(): Promise<void> {
  if (getMutableConfig().mode === "zen") {
    TestUI.appendEmptyWordElement(getActiveWordIndex() + 1);
    return;
  }

  let bound = 100; // how many extra words to aim for AFTER the current word

  const funboxToPush =
    getActiveFunboxes()
      .flatMap((fb) => fb.properties ?? [])
      .find((prop) => prop.startsWith("toPush:")) ?? "";

  const toPushCount = funboxToPush?.split(":")[1];
  if (toPushCount !== undefined) bound = +toPushCount - 1;

  if (TestWords.words.length - (getActiveWordIndex() + 1) > bound) {
    console.debug("Not adding word, enough words already");
    return;
  }
  if (WordsGenerator.areAllWordsGenerated()) {
    console.debug("Not adding word, all words generated");
    return;
  }
  const sectionFunbox = findSingleActiveFunboxWithFunction("pullSection");
  if (sectionFunbox) {
    if (TestWords.words.length - getActiveWordIndex() < 20) {
      const section = await sectionFunbox.functions.pullSection(
        getMutableConfig().language,
      );

      if (section === false) {
        showErrorNotification(
          "Error while getting section. Please try again later",
        );
        toggleFunbox(sectionFunbox.name);
        void restart();
        return;
      }

      if (section === undefined) return;

      let wordCount = 0;
      for (let i = 0; i < section.words.length; i++) {
        const word = section.words[i] as string;
        if (
          wordCount >= getMutableConfig().words &&
          getMutableConfig().mode === "words"
        ) {
          break;
        }
        wordCount++;
        const newWord = TestWords.words.push(
          WordsGenerator.appendCommitCharacter(word),
          i,
        );
        TestUI.addWord(newWord.display);
      }
    }
  }

  try {
    const randomWord = await getTestSession().nextWord(
      TestWords.words.length,
      bound,
      TestWords.words.get(TestWords.words.length - 1)?.text ?? "",
      TestWords.words.get(TestWords.words.length - 2)?.text,
      WordsGenerator,
    );

    const newWord = TestWords.words.push(
      randomWord.word,
      randomWord.sectionIndex,
    );
    TestUI.addWord(newWord.display);
  } catch (e) {
    fail("word generation error");
    showErrorNotification(
      "Error while getting next word. Please try again later",
      {
        error: e,
        important: true,
      },
    );
  }

  // strip the trailing commit separator once the final word has been generated
  // (covers the section and lazy paths)
  if (WordsGenerator.areAllWordsGenerated()) {
    TestWords.words.removeCommitCharacterFromLastWord();
  }
}

export function fail(reason: string): void {
  getTestSession().finish(performance.now(), reason);
}

const zipfCheck = createAppOwned(() => {
  const check = debounce(250, async () => {
    const lease = captureApplication();
    const supports = await JSONData.checkIfLanguageSupportsZipf(
      getMutableConfig().language,
    );
    if (lease.signal.aborted) return;
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
    if (getActivePage() === "test") {
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
