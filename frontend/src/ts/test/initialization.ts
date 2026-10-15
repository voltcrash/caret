import { updateClassNames } from "../utils/cn";

import * as TestUI from "./test-ui";

import * as Misc from "../utils/misc";
import * as JSONData from "../utils/json-data";

import {
  showNoticeNotification,
  showErrorNotification,
} from "../states/notifications";
import * as CustomText from "./custom-text";

import * as Funbox from "./funbox/funbox";

import { getActivePage, isAuthenticated } from "../states/core";
import {
  setIsDirectionReversed,
  setIsLanguageRightToLeft,
  setKoreanStatus,
  setIsTestRestarting,
  getCurrentQuote,
  resetActiveWordIndex,
  setWordsHaveNewline,
  setWordsHaveNumbers,
  setWordsHaveTab,
  setTestInitError,
} from "../states/test";

import * as TestWords from "./test-words";
import * as WordsGenerator from "./words-generator";

import { highlight } from "../events/keymap";
import * as LazyModeState from "../states/remember-lazy-mode";

import {
  getActiveFunboxNames,
  isFunboxActiveWithProperty,
} from "./funbox/list";

import { WordGenError } from "@oxytype/typing-core/errors";
import { tryCatch } from "@oxytype/util/trycatch";
import * as Sentry from "../sentry";
import { showLoaderBar, hideLoaderBar } from "../states/loader-bar";

import { getTypingTestElement } from "../states/test-dom";

import { getMutableConfig } from "../config/store";
import { setQuoteLengthAll, setConfig } from "../config/setters";
import { getTestSession } from "./events/data";

import { nthElementFromArray } from "../utils/arrays";
import { hasKoreanCharacters } from "@oxytype/typing-core/strings";

import { testLogicState } from "./logic-state";
export async function init(): Promise<boolean> {
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
    JSONData.getLanguage(getMutableConfig().language),
  );
  hideLoaderBar();

  if (error) {
    showErrorNotification("Failed to load language", { error });
  }

  if (!language || language.name !== getMutableConfig().language) {
    return await init();
  }

  if (getActivePage() === "test") {
    await Funbox.activate();
  }

  if (getMutableConfig().mode === "quote") {
    if (getMutableConfig().quoteLength.includes(-3) && !isAuthenticated()) {
      setQuoteLengthAll();
    }
  }

  const allowLazyMode =
    !language.noLazyMode || getMutableConfig().mode === "custom";

  // polyglot mode, check to enable lazy mode if any support it
  if (getActiveFunboxNames().includes("polyglot")) {
    const polyglotLanguages = getMutableConfig().customPolyglot;
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

    if (getMutableConfig().lazyMode && !anySupportsLazyMode) {
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
    if (getMutableConfig().lazyMode && !allowLazyMode) {
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

  if (!getMutableConfig().lazyMode && !language.noLazyMode) {
    LazyModeState.setRemember(false);
  }

  if (getMutableConfig().mode === "custom") {
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
    mode: getMutableConfig().mode,
    mode2: Misc.getMode2(getMutableConfig(), null),
    funbox: getMutableConfig().funbox,
    currentQuote: getCurrentQuote(),
  });

  let wordsHaveTab = false;
  let wordsHaveNewline = false;
  let allRightToLeft: boolean | undefined = undefined;
  let allJoiningScript: boolean | undefined = undefined;
  let generatedWords: string[] = [];
  let generatedSectionIndexes: number[] = [];
  try {
    const gen = await getTestSession().generate(language, WordsGenerator);
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

  if (
    getMutableConfig().keymapMode === "next" &&
    getMutableConfig().mode !== "zen"
  ) {
    highlight(
      nthElementFromArray(
        Array.from(TestWords.words.getCurrent()?.text ?? ""),
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
