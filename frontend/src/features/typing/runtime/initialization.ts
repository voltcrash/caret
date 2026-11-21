import { applyPendingLocalConfig } from "#shared/config/lifecycle.ts";
import { captureTypingRoute, isTypingRouteActive } from "../scope";
import { getBrowserEngine } from "#shared/engine/owner.client.ts";
import { getContentHost } from "./content/host.client";
import { EngineFailure } from "@caret/typing-engine/failure";
import {
  applyEngineRecovery,
  generationFailureIsNotice,
} from "./recovery.client";
import { updateClassNames } from "#shared/utils/cn.ts";

import * as TestUI from "./test/ui";

import * as Misc from "#shared/utils/misc.ts";
import * as JSONData from "#shared/utils/json-data.ts";

import {
  showNoticeNotification,
  showErrorNotification,
} from "#shared/states/notifications.ts";
import * as CustomText from "./content/custom-text";

import * as Funbox from "./funbox/funbox";

import { isAuthenticated } from "#shared/states/core.ts";
import {
  setIsDirectionReversed,
  setIsLanguageRightToLeft,
  getCurrentQuote,
  setWordsHaveNewline,
  setWordsHaveNumbers,
  setWordsHaveTab,
} from "#shared/states/test.ts";
import { resetActiveWordIndex } from "#features/typing/state/active-word.ts";
import { setKoreanStatus } from "#features/typing/state/composition.ts";

import * as TestWords from "./test/words";

import { highlight } from "#features/typing/state/keymap.ts";
import * as LazyModeState from "./remember-lazy-mode";

import {
  getActiveFunboxNames,
  isFunboxActiveWithProperty,
} from "./funbox/list";

import { tryCatch } from "@caret/util/trycatch";
import * as Sentry from "#shared/sentry.ts";
import { showLoaderBar, hideLoaderBar } from "#shared/states/loader-bar.ts";

import { getTypingTestElement } from "#shared/states/test-dom.ts";

import { peekConfig } from "#shared/config/store.ts";
import { setQuoteLengthAll, setConfig } from "#shared/config/setters.ts";

import { nthElementFromArray } from "#shared/utils/arrays.ts";
import { hasKoreanCharacters } from "@caret/web-shared/strings";

import { testLogicState } from "./test/logic-state";
export async function init(
  lease: {
    isCurrent: () => boolean;
    signal?: AbortSignal;
  } = captureTypingRoute(),
): Promise<boolean> {
  if (!lease.isCurrent()) return false;
  console.debug("Initializing test");
  testLogicState.testReinitCount++;
  if (testLogicState.testReinitCount > 3) {
    if (testLogicState.lastInitError) {
      void Sentry.captureException(testLogicState.lastInitError);
    }
    const typingTest = getTypingTestElement();
    typingTest.className = updateClassNames(
      typingTest.className,
      "hidden",
      true,
    );
    throw (
      testLogicState.lastInitError ?? new Error("Test initialization failed")
    );
  }

  const languageRequest = tryCatch(JSONData.getLanguage(peekConfig().language));
  showLoaderBar();
  try {
    await getBrowserEngine().load();
    await applyPendingLocalConfig();
  } catch (error) {
    if (!lease.isCurrent()) return false;
    hideLoaderBar();
    throw error;
  }
  if (!lease.isCurrent()) return false;

  TestWords.words.reset();
  resetActiveWordIndex();

  showLoaderBar();
  const { data: language, error } = await languageRequest;
  if (!lease.isCurrent()) return false;
  hideLoaderBar();

  if (error) {
    showErrorNotification("Failed to load language", { error });
  }

  if (!language || language.name !== peekConfig().language) {
    return await init(lease);
  }

  if (isTypingRouteActive()) {
    await Funbox.activate(undefined, lease);
    if (!lease.isCurrent()) return false;
  }

  if (peekConfig().mode === "quote") {
    if (peekConfig().quoteLength.includes(-3) && !isAuthenticated()) {
      setQuoteLengthAll();
    }
  }

  const allowLazyMode = !language.noLazyMode || peekConfig().mode === "custom";

  // polyglot mode, check to enable lazy mode if any support it
  if (getActiveFunboxNames().includes("polyglot")) {
    const polyglotLanguages = peekConfig().customPolyglot;
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

    if (!lease.isCurrent()) return false;
    if (peekConfig().lazyMode && !anySupportsLazyMode) {
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
    if (peekConfig().lazyMode && !allowLazyMode) {
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

  if (!peekConfig().lazyMode && !language.noLazyMode) {
    LazyModeState.setRemember(false);
  }

  if (peekConfig().mode === "custom") {
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
    mode: peekConfig().mode,
    mode2: Misc.getMode2(peekConfig(), null),
    funbox: peekConfig().funbox,
    currentQuote: getCurrentQuote(),
  });

  let wordsHaveTab = false;
  let wordsHaveNewline = false;
  let allRightToLeft: boolean | undefined = undefined;
  let allJoiningScript: boolean | undefined = undefined;
  let generatedWords: string[] = [];
  let generatedSectionIndexes: number[] = [];
  try {
    const gen = await getContentHost().prepare(language, lease);
    if (!lease.isCurrent()) return false;
    generatedWords = gen.words;
    generatedSectionIndexes = gen.sectionIndexes;
    wordsHaveTab = gen.hasTab;
    wordsHaveNewline = gen.hasNewline;
    ({ allRightToLeft, allJoiningScript } = gen);
  } catch (e) {
    if (!lease.isCurrent()) return false;
    hideLoaderBar();
    if (e instanceof Error) {
      testLogicState.lastInitError = e;
    }
    console.error(e);
    if (e instanceof EngineFailure) applyEngineRecovery(e);
    if (e instanceof EngineFailure && generationFailureIsNotice(e)) {
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

    return await init(lease);
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

  if (peekConfig().keymapMode === "next" && peekConfig().mode !== "zen") {
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
