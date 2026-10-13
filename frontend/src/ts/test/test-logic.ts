import { animateAsync } from "../anim";
import { updateClassNames } from "../utils/cn";
import Ape from "../ape";
import * as TestUI from "./test-ui";
import * as Strings from "../utils/strings";
import * as Misc from "../utils/misc";
import * as JSONData from "../utils/json-data";
import * as Numbers from "@oxytype/util/numbers";
import {
  showNoticeNotification,
  showErrorNotification,
  showSuccessNotification,
} from "../states/notifications";
import * as CustomText from "./custom-text";
import * as PractiseWords from "./practise-words";
import * as Funbox from "./funbox/funbox";
import * as PaceCaret from "./pace-caret";
import * as TestTimer from "./test-timer";
import * as DB from "../db";
import * as Replay from "./replay";
import { getActiveTags } from "../collections/tags";
import * as TodayTracker from "./today-tracker";
import * as ChallengeContoller from "../controllers/challenge-controller";
import { clearQuoteStats } from "../states/quote-rate";
import * as Result from "./result";
import {
  getActivePage,
  getCustomTextIndicator,
  isAuthenticated,
} from "../states/core";
import {
  setIsDirectionReversed,
  setIsLanguageRightToLeft,
  setKoreanStatus,
  setLastEventLog,
  setIsTestRestarting,
  isTestRestarting,
  getCurrentQuote,
  getIncompleteSeconds,
  getIncompleteTests,
  getRestartCount,
  isPaceRepeat,
  isRepeated,
  isTestActive,
  pushIncompleteTest,
  resetIncompleteTests,
  setIsPaceRepeat,
  setIsRepeated,
  setIsTestInvalid,
  setLastResult,
  getActiveWordIndex,
  resetActiveWordIndex,
  getBailedOut,
  isResultCalculating,
  setBailedOut,
  setLastSignedOutResult,
  setResultCalculating,
  setResultLoading,
  setResultVisible,
  setTestActive,
  setWordsHaveNewline,
  setWordsHaveNumbers,
  setWordsHaveTab,
  getResultVisible,
  setTestInitError,
} from "../states/test";
import { restartTestEvent } from "../events/test";
import * as TestWords from "./test-words";
import * as WordsGenerator from "./words-generator";
import * as PageTransition from "../states/page-transition";
import { configEvent } from "../events/config";
import { timerEvent } from "../events/timer";
import * as AnalyticsController from "../controllers/analytics-controller";
import { hashResult, preloadResultHasher } from "../utils/result-hash";
import { getAuthenticatedUser } from "../auth-client";
import { highlight } from "../events/keymap";
import * as LazyModeState from "../states/remember-lazy-mode";
import {
  CompletedEvent,
  CompletedEventCustomText,
} from "@oxytype/schemas/results";
import {
  findSingleActiveFunboxWithFunction,
  getActiveFunboxes,
  getActiveFunboxesWithFunction,
  getActiveFunboxNames,
  isFunboxActive,
  isFunboxActiveWithProperty,
} from "./funbox/list";
import { getFunbox } from "@oxytype/funbox";
import * as CompositionState from "../states/composition";
import { SavedResult } from "../constants/default-snapshot";
import { WordGenError } from "@oxytype/typing-core/errors";
import { tryCatch } from "@oxytype/util/trycatch";
import * as Sentry from "../sentry";
import { showLoaderBar, hideLoaderBar } from "../states/loader-bar";
import { canQuickRestart } from "../utils/quick-restart";
import { setInputElementValue } from "../input/input-element";
import { debounce } from "throttle-debounce";
import { getTypingTestElement } from "../states/test-dom";
import { setAccountButtonSpinner } from "../states/header";
import { Config } from "../config/store";
import { setQuoteLengthAll, toggleFunbox, setConfig } from "../config/setters";
import {
  testSession,
  resetTestEvents,
  cleanupData,
  logEventsDataToTheConsoleTable,
  forceReleaseAllKeys,
  buildEventLog,
} from "./events/data";
import {
  getIncompleteTestSeconds,
  getDateBasedTestDurationMs,
  getInputHistory,
} from "@oxytype/typing-core/events/stats";
import {
  getInvalidResultReason,
  InvalidResultReason,
  isAfkResult,
} from "@oxytype/typing-core/result-validity";
import { getLiveCachedAccuracy } from "./events/live-cache";
import { isDevEnvironment } from "../utils/env";
import { resetModifierState } from "../states/modifiers";
import { nthElementFromArray } from "../utils/arrays";
import { hasKoreanCharacters } from "@oxytype/typing-core/strings";
import { shouldRepeatQuote } from "@oxytype/typing-core/restart";
import { countInvalidResultFields } from "@oxytype/typing-core/result-fields";

type TestLogicState = {
  failReason: string;
  lastInitError: Error | null;
  showedLazyModeNotification: boolean;
  testReinitCount: number;
  retrySaving: RetrySaving;
};

const testLogicState: TestLogicState = {
  failReason: "",
  lastInitError: null,
  showedLazyModeNotification: false,
  testReinitCount: 0,
  retrySaving: { completedEvent: null, canRetry: false },
};

const invalidMessages: Record<
  Exclude<InvalidResultReason, "failed">,
  string
> = {
  "inconsistent duration": "inconsistent test duration",
  "too short": "too short",
  afk: "AFK detected",
  repeated: "repeated",
  wpm: "wpm",
  raw: "raw",
  accuracy: "accuracy",
};

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
  testSession.start(now, false);

  for (const fb of getActiveFunboxesWithFunction("start")) {
    fb.functions.start();
  }

  try {
    if (Config.paceCaret !== "off" || (Config.repeatedPace && isPaceRepeat())) {
      PaceCaret.start();
    }
  } catch (e) {}
  //use a recursive self-adjusting timer to avoid time drift
  void TestTimer.start(now);
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
      if (Config.mode !== "zen") options.event?.preventDefault();
      if (
        !canQuickRestart(
          Config.mode,
          Config.words,
          Config.time,
          CustomText.getData(),
          getCustomTextIndicator()?.isLong ?? false,
        )
      ) {
        let message = "Use your mouse to confirm.";
        if (Config.quickRestart === "tab") {
          message = "Press shift + tab or use your mouse to confirm.";
        } else if (Config.quickRestart === "esc") {
          message = "Press shift + escape or use your mouse to confirm.";
        } else if (Config.quickRestart === "enter") {
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

    if (Config.resultSaving) {
      // Finalize the abandoned test before measuring it: logging the timer
      // "end" event gives getAfkDuration its interval boundaries, so idle time
      // is actually subtracted. Without it AFK is always 0 and the full
      // wall-clock lifetime (incl. unbounded idle) leaks into the result.
      TestTimer.clear(true);
      const liveEventLog = buildEventLog();
      const tt = getIncompleteTestSeconds(liveEventLog);
      const acc = Numbers.roundTo2(getLiveCachedAccuracy());
      pushIncompleteTest({ acc, seconds: tt });
    }
  }

  const currentQuote = getCurrentQuote();
  if (
    shouldRepeatQuote(Config) &&
    currentQuote !== null &&
    Config.language.startsWith(currentQuote.language) &&
    (isTestActive() || testLogicState.failReason !== "")
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
  testLogicState.failReason = "";

  const repeatWithPace =
    (Config.repeatedPace && options.withSameWordset) ?? false;
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

async function init(): Promise<boolean> {
  console.debug("Initializing test");
  testLogicState.testReinitCount++;
  if (testLogicState.testReinitCount > 3) {
    if (testLogicState.lastInitError) {
      void Sentry.captureException(testLogicState.lastInitError);
    }
    setTestInitError({
      message: testLogicState.lastInitError
        ? `${testLogicState.lastInitError.name}: ${testLogicState.lastInitError.message}`
        : undefined,
    });
    const typingTest = getTypingTestElement();
    typingTest.className = updateClassNames(
      typingTest.className,
      "hidden",
      true,
    );
    setIsTestRestarting(false);
    return false;
  }

  TestWords.words.reset();
  resetActiveWordIndex();

  showLoaderBar();
  const { data: language, error } = await tryCatch(
    JSONData.getLanguage(Config.language),
  );
  hideLoaderBar();

  if (error) {
    showErrorNotification("Failed to load language", { error });
  }

  if (!language || language.name !== Config.language) {
    return await init();
  }

  if (getActivePage() === "test") {
    await Funbox.activate();
  }

  if (Config.mode === "quote") {
    if (Config.quoteLength.includes(-3) && !isAuthenticated()) {
      setQuoteLengthAll();
    }
  }

  const allowLazyMode = !language.noLazyMode || Config.mode === "custom";

  // polyglot mode, check to enable lazy mode if any support it
  if (getActiveFunboxNames().includes("polyglot")) {
    const polyglotLanguages = Config.customPolyglot;
    const languagePromises = polyglotLanguages.map(async (langName) => {
      const { data: lang, error } = await tryCatch(
        JSONData.getLanguage(langName),
      );
      if (error) {
        showErrorNotification(`Failed to load language: ${langName}`, {
          error,
        });
      }
      return lang;
    });

    const anySupportsLazyMode = (await Promise.all(languagePromises))
      .filter((lang) => lang !== null)
      .some((lang) => !lang.noLazyMode);

    if (Config.lazyMode && !anySupportsLazyMode) {
      LazyModeState.setRemember(true);
      if (!testLogicState.showedLazyModeNotification) {
        showNoticeNotification(
          "None of the selected polyglot languages support lazy mode.",
          {
            important: true,
          },
        );
        testLogicState.showedLazyModeNotification = true;
      }
      setConfig("lazyMode", false);
    } else if (LazyModeState.getRemember() && anySupportsLazyMode) {
      setConfig("lazyMode", true);
      LazyModeState.setRemember(false);
      testLogicState.showedLazyModeNotification = false;
    }
  } else {
    // normal mode
    if (Config.lazyMode && !allowLazyMode) {
      LazyModeState.setRemember(true);
      if (!testLogicState.showedLazyModeNotification) {
        showNoticeNotification("This language does not support lazy mode.", {
          important: true,
        });
        testLogicState.showedLazyModeNotification = true;
      }
      setConfig("lazyMode", false);
    } else if (LazyModeState.getRemember() && allowLazyMode) {
      setConfig("lazyMode", true);
      LazyModeState.setRemember(false);
      testLogicState.showedLazyModeNotification = false;
    }
  }

  if (!Config.lazyMode && !language.noLazyMode) {
    LazyModeState.setRemember(false);
  }

  if (Config.mode === "custom") {
    console.debug("Custom text", CustomText.getData());
  }

  console.log("Inializing test", {
    language: {
      ...language,
      words: `${language.words.length} words`,
    },
    customText: {
      ...CustomText.getData(),
      text: `${CustomText.getText().length} words`,
    },
    mode: Config.mode,
    mode2: Misc.getMode2(Config, null),
    funbox: Config.funbox,
    currentQuote: getCurrentQuote(),
  });

  let wordsHaveTab = false;
  let wordsHaveNewline = false;
  let allRightToLeft: boolean | undefined = undefined;
  let allJoiningScript: boolean | undefined = undefined;
  let generatedWords: string[] = [];
  let generatedSectionIndexes: number[] = [];
  try {
    const gen = await testSession.generate(language, WordsGenerator);
    generatedWords = gen.words;
    generatedSectionIndexes = gen.sectionIndexes;
    wordsHaveTab = gen.hasTab;
    wordsHaveNewline = gen.hasNewline;
    ({ allRightToLeft, allJoiningScript } = gen);
  } catch (e) {
    hideLoaderBar();
    if (e instanceof WordGenError || e instanceof Error) {
      testLogicState.lastInitError = e;
    }
    console.error(e);
    if (e instanceof WordGenError) {
      if (e.message.length > 0) {
        showNoticeNotification(e.message, {
          important: true,
        });
      }
    } else {
      showErrorNotification("Failed to generate words", {
        error: e,
        important: true,
      });
    }

    return await init();
  }

  let hasNumbers = false;

  for (const word of generatedWords) {
    if (/\d/g.test(word) && !hasNumbers) {
      hasNumbers = true;
    }
  }

  setWordsHaveNumbers(hasNumbers);
  setWordsHaveTab(wordsHaveTab);
  setWordsHaveNewline(wordsHaveNewline);

  if (hasKoreanCharacters(generatedWords.join().normalize())) {
    setKoreanStatus(true);
  }

  for (let i = 0; i < generatedWords.length; i++) {
    TestWords.words.push(
      generatedWords[i] as string,
      generatedSectionIndexes[i] as number,
    );
  }

  if (WordsGenerator.areAllWordsGenerated()) {
    TestWords.words.removeCommitCharacterFromLastWord();
  }

  if (Config.keymapMode === "next" && Config.mode !== "zen") {
    highlight(
      nthElementFromArray(
        // ignoring for now but this might need a different approach
        // oxlint-disable-next-line no-misused-spread
        [...(TestWords.words.getCurrent()?.text ?? "")],
        0,
      ) as string,
    );
  }

  Funbox.toggleScript(TestWords.words.getCurrent()?.text ?? "");
  TestUI.setJoiningClass(allJoiningScript ?? language.joiningScript ?? false);

  const isLanguageRTL = allRightToLeft ?? language.rightToLeft ?? false;
  setIsLanguageRightToLeft(isLanguageRTL);
  setIsDirectionReversed(isFunboxActiveWithProperty("reverseDirection"));

  console.debug("Test initialized with words", TestWords.words.get());
  console.debug(
    "Test initialized with section indexes",
    generatedSectionIndexes,
  );
  return true;
}

//add word during the test
export async function addWord(): Promise<void> {
  if (Config.mode === "zen") {
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
        Config.language,
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
        if (wordCount >= Config.words && Config.mode === "words") {
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
    const randomWord = await testSession.nextWord(
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
    timerEvent.dispatch({ key: "fail", value: "word generation error" });
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

type RetrySaving = {
  completedEvent: CompletedEvent | null;
  canRetry: boolean;
};

export async function retrySavingResult(): Promise<void> {
  const { completedEvent } = testLogicState.retrySaving;

  if (completedEvent === null) {
    showNoticeNotification(
      "Could not retry saving the result as the result no longer exists.",
      {
        durationMs: 5000,
        important: true,
      },
    );

    return;
  }

  if (!testLogicState.retrySaving.canRetry) {
    return;
  }

  testLogicState.retrySaving.canRetry = false;
  Result.updateRetrySaving(false);

  showNoticeNotification("Retrying to save...");

  await saveResult(completedEvent, true);
}

function getCompletedEventCustomText(): CompletedEventCustomText | undefined {
  if (Config.mode !== "custom") return undefined;
  const temp = CustomText.getData();
  return {
    textLen: temp.text.length,
    mode: temp.mode,
    pipeDelimiter: temp.pipeDelimiter,
    limit: temp.limit,
  };
}

export async function finish(difficultyFailed = false): Promise<void> {
  if (!isTestActive()) return;
  setResultCalculating(true);
  const now = performance.now();
  TestTimer.clear(true, now);

  // fade out the test and show loading
  // because the css animation has a delay,
  // if the test calculation is fast the loading will not show
  await animateAsync(getTypingTestElement(), {
    opacity: 0,
    duration: Misc.applyReducedMotion(125),
  });
  const typingTest = getTypingTestElement();
  typingTest.className = updateClassNames(typingTest.className, "hidden", true);
  setResultLoading(true);
  await Misc.sleep(0); //allow ui update

  TestUI.onTestFinish();

  if (isRepeated() && Config.mode === "quote") {
    setIsRepeated(false);
  }

  forceReleaseAllKeys();

  setResultVisible(true);
  setTestActive(false);

  cleanupData();

  if (isDevEnvironment()) {
    logEventsDataToTheConsoleTable();
  }

  const eventLog = buildEventLog();
  const ce = testSession.complete(eventLog, {
    config: Config,
    currentQuote: getCurrentQuote(),
    customText: getCompletedEventCustomText(),
    tags: getActiveTags().map((tag) => tag._id),
    bailedOut: getBailedOut(),
    restartCount: getRestartCount(),
    incompleteTests: getIncompleteTests(),
    incompleteSeconds: getIncompleteSeconds(),
    timestamp: Date.now(),
  });
  PaceCaret.setLastTestWpm(ce.wpm);

  console.debug("Completed event object", ce);

  let dontSave = false;

  if (countInvalidResultFields(ce) > 0) {
    console.log(ce);
    showErrorNotification(
      "Failed to build result object: One of the fields is undefined or NaN",
    );
    dontSave = true;
  }

  const completedEvent = structuredClone(ce) as CompletedEvent;

  setLastEventLog(eventLog);
  setLastResult(structuredClone(completedEvent));

  ///////// completed event ready

  const afkDetected = isAfkResult(eventLog, getBailedOut());
  const invalidReason = getInvalidResultReason({
    result: completedEvent,
    eventLog,
    bailedOut: getBailedOut(),
    failed: difficultyFailed,
    repeated: isRepeated(),
    lbOptOut: DB.getSnapshot()?.lbOptOut === true,
    customLimit: CustomText.getData().limit,
  });
  const tooShort = invalidReason === "too short";
  if (invalidReason === "failed") {
    showNoticeNotification(`Test failed - ${testLogicState.failReason}`, {
      durationMs: 1000,
    });
    dontSave = true;
  } else if (invalidReason !== undefined) {
    if (invalidReason === "inconsistent duration") {
      console.error(
        "Test duration inconsistent",
        ce.testDuration,
        getDateBasedTestDurationMs(eventLog) / 1000,
      );
    }
    showNoticeNotification(`Test invalid - ${invalidMessages[invalidReason]}`);
    setIsTestInvalid(true);
    dontSave = true;
  }

  // test is valid

  if (isRepeated() || difficultyFailed) {
    if (Config.resultSaving) {
      pushIncompleteTest({
        acc: completedEvent.acc,
        seconds: getIncompleteTestSeconds(eventLog),
      });
    }
  }

  const customTextName = getCustomTextIndicator()?.name ?? "";
  const isLong = getCustomTextIndicator()?.isLong === true;
  if (Config.mode === "custom" && customTextName !== "" && isLong) {
    // Let's update the custom text progress
    if (
      getBailedOut() ||
      getInputHistory(eventLog).length < TestWords.words.length
    ) {
      // They bailed out

      const history = getInputHistory(eventLog);
      let historyLength = history?.length;
      const wordIndex = historyLength - 1;

      const lastWordInputLength = history[wordIndex]?.length ?? 0;

      // compare against display.length (not textWithCommit.length): the input
      // history holds the typed letters, not the committing space separator, so
      // a space word is "complete" at text.length. display includes a newline
      // commit, which is a required typed char.
      if (
        lastWordInputLength <
        (TestWords.words.get(wordIndex)?.display.length ?? 0)
      ) {
        historyLength--;
      }

      const newProgress =
        CustomText.getCustomTextLongProgress(customTextName) + historyLength;
      CustomText.setCustomTextLongProgress(customTextName, newProgress);
      showSuccessNotification("Long custom text progress saved", {
        durationMs: 5000,
        important: true,
      });

      let newText = CustomText.getCustomText(customTextName, true);
      newText = newText.slice(newProgress);
      CustomText.setText(newText);
    } else {
      // They finished the test
      CustomText.setCustomTextLongProgress(customTextName, 0);
      const text = CustomText.getCustomText(customTextName, true);
      CustomText.setText(text);
      showSuccessNotification("Long custom text completed", {
        durationMs: 5000,
        important: true,
      });
    }
  }

  TodayTracker.addSeconds(
    completedEvent.testDuration - completedEvent.afkDuration,
  );
  Result.updateTodayTracker();

  let savingResultPromise: ReturnType<typeof saveResult> =
    Promise.resolve(null);
  const user = getAuthenticatedUser();
  if (user !== null) {
    // logged in
    if (dontSave) {
      void AnalyticsController.log("testCompletedInvalid");
    } else {
      resetIncompleteTests();

      if (!completedEvent.bailedOut) {
        const challenge = ChallengeContoller.verify(completedEvent);
        if (challenge !== null) completedEvent.challenge = challenge;
      }

      completedEvent.uid = user.uid;

      savingResultPromise = saveResult(completedEvent, false);
      void savingResultPromise.then((response) => {
        if (response?.status === 200) {
          void AnalyticsController.log("testCompleted");
        }
      });
    }
  } else {
    // logged out
    void AnalyticsController.log("testCompletedNoLogin");
    if (!dontSave) {
      // if its valid save it for later
      setLastSignedOutResult(completedEvent);
    }
    dontSave = true;
  }

  const resultUpdatePromise = Result.update(
    completedEvent,
    difficultyFailed,
    testLogicState.failReason,
    afkDetected,
    isRepeated(),
    tooShort,
    getCurrentQuote(),
    dontSave,
  );

  await Promise.all([savingResultPromise, resultUpdatePromise]);
}

async function saveResult(
  completedEvent: CompletedEvent,
  isRetrying: boolean,
): Promise<null | Awaited<ReturnType<typeof Ape.results.add>>> {
  if (!Config.resultSaving) {
    showErrorNotification("Result not saved: disabled by user", {
      durationMs: 3000,
      customTitle: "Notice",
      important: true,
    });
    return null;
  }

  const result = structuredClone(completedEvent);

  if (result.testDuration > 122) {
    result.chartData = "toolong";
    result.keySpacing = "toolong";
    result.keyDuration = "toolong";
  }
  const unhashed: Omit<CompletedEvent, "hash"> & { hash?: string } = result;
  delete unhashed.hash;
  result.hash = await hashResult(result);

  setAccountButtonSpinner(true);

  const response = await Ape.results.add({ body: { result } });

  setAccountButtonSpinner(false);

  if (response.status !== 200) {
    //only allow retry if status is not in this list
    if (![460, 461, 463, 464, 465, 466].includes(response.status)) {
      testLogicState.retrySaving.canRetry = true;
      Result.updateRetrySaving(true);
      if (!isRetrying) {
        testLogicState.retrySaving.completedEvent = result;
      }
    }
    console.log("Error saving result", result);
    if (response.body.message === "Old key data format") {
      response.body.message =
        "Old key data format. Please refresh the page to download the new update. If the problem persists, please contact support.";
    }
    if (
      /"result\..+" is (not allowed|required)/gi.test(response.body.message)
    ) {
      response.body.message =
        "Looks like your result data is using an incorrect schema. Please refresh the page to download the new update. If the problem persists, please contact support.";
    }
    showErrorNotification("Failed to save result", { response });
    return response;
  }

  const data = response.body.data;
  Result.updateSavedResultId(data.insertedId);

  const localDataToSave: DB.SaveLocalResultData = {};

  if (data.xp !== undefined) {
    localDataToSave.xp = data.xp;
    if (getResultVisible()) {
      localDataToSave.xpBreakdown = data.xpBreakdown;
    }
  }

  if (data.streak !== undefined) {
    localDataToSave.streak = data.streak;
  }

  if (data.insertedId !== undefined) {
    const snapshotResult: SavedResult = Object.assign(structuredClone(result), {
      _id: data.insertedId,
    });
    if (data.isPb !== undefined && data.isPb) {
      snapshotResult.isPb = true;
    }
    localDataToSave.result = snapshotResult;
  }

  if (data.isPb !== undefined && data.isPb) {
    //new pb
    const localPb = DB.getLocalPB(
      result.mode,
      result.mode2,
      result.punctuation,
      result.numbers,
      result.language,
      result.difficulty,
      result.lazyMode,
      getFunbox(result.funbox),
    );

    if (localPb !== undefined) {
      void Result.showConfetti();
    }
    Result.showCrown("normal");

    localDataToSave.isPb = true;
  } else {
    Result.showErrorCrownIfNeeded();
  }

  Result.updateDailyLeaderboardRank(data.dailyLeaderboardRank);

  Result.updateRetrySaving(false);
  if (isRetrying) {
    showSuccessNotification("Result saved", { important: true });
  }
  DB.saveLocalResult(localDataToSave);
  return response;
}

export function fail(reason: string): void {
  testLogicState.failReason = reason;
  void finish(true);
}

const debouncedZipfCheck = debounce(250, async () => {
  const supports = await JSONData.checkIfLanguageSupportsZipf(Config.language);
  if (supports === "no") {
    showNoticeNotification(
      `${Strings.capitalizeFirstLetter(
        Strings.getLanguageDisplayString(Config.language),
      )} does not support Zipf funbox, because the list is not ordered by frequency. Please try another word list.`,
      {
        durationMs: 7000,
      },
    );
  }
  if (supports === "unknown") {
    showNoticeNotification(
      `${Strings.capitalizeFirstLetter(
        Strings.getLanguageDisplayString(Config.language),
      )} may not support Zipf funbox, because we don't know if it's ordered by frequency or not. If you would like to add this label, please contact us.`,
      {
        durationMs: 7000,
      },
    );
  }
});

restartTestEvent.subscribe((event) => void restart(event), import.meta.hot);

// ===============================

configEvent.subscribe(
  ({ key, newValue, nosave }) => {
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
        Config.funbox.includes("layoutfluid")
      ) {
        void restart();
      }

      if (
        key === "keymapMode" &&
        newValue === "next" &&
        Config.mode !== "zen"
      ) {
        setTimeout(() => {
          highlight(
            nthElementFromArray(
              // ignoring for now but this might need a different approach
              // oxlint-disable-next-line no-misused-spread
              [...(TestWords.words.getCurrent()?.text ?? "")],
              0,
            ) as string,
          );
        }, 0);
      }
      if (
        (key === "language" || key === "funbox") &&
        Config.funbox.includes("zipf")
      ) {
        debouncedZipfCheck();
      }
    }
    if (key === "lazyMode" && !nosave) {
      if (Config.language.startsWith("arabic")) {
        LazyModeState.setArabicPref(newValue);
      }
    }
  },
  import.meta.hot,
);

timerEvent.subscribe(
  ({ key: eventKey, value: eventValue }) => {
    if (eventKey === "fail" && eventValue !== undefined) fail(eventValue);
    if (eventKey === "finish") void finish();
  },
  import.meta.hot,
);
