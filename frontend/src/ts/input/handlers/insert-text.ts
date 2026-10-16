import { evaluateInsert } from "@oxytype/typing-core/input/engine";
import * as TestUI from "../../../features/typing/runtime/test-ui";
import * as TestWords from "../../../features/typing/runtime/test-words";
import {
  getInputElementValue,
  replaceInputElementLastValueChar,
  setInputElementValue,
  appendToInputElementValue,
} from "../input-element";
import {
  checkIfFailedDueToDifficulty,
  checkIfFailedDueToMinBurst,
  checkIfFinished,
} from "../helpers/fail-or-finish";
import { removeLanguageSize } from "../../utils/strings";
import * as TestLogic from "../../../features/typing/runtime/test-logic";
import { getMutableConfig } from "../../config/store";
import { flash } from "../../events/keymap";
import * as WeakSpot from "../../../features/typing/runtime/weak-spot";
import * as CompositionState from "../../states/composition";
import {
  isCorrectShiftUsed,
  getIncorrectShiftsInARow,
  incrementIncorrectShiftsInARow,
  resetIncorrectShiftsInARow,
} from "../state";
import { showNoticeNotification } from "../../states/notifications";
import { goToNextWord, goToPreviousWord } from "../helpers/word-navigation";
import { onBeforeInsertText } from "./before-insert-text";
import {
  getCurrentInput,
  logTestEvent,
} from "../../../features/typing/runtime/events/data";
import { getCommitCharacterType, normalizeData } from "../helpers/util";
import { areAllWordsGenerated } from "../../../features/typing/runtime/words-generator";
import { getActiveWordIndex, isTestActive } from "../../states/test";
import { DeleteInputType } from "../helpers/input-type";

const charOverrides = new Map<string, string>([
  ["…", "..."],
  // ["œ", "oe"],
  // ["æ", "ae"],
]);

const languageCharOverrides = new Map<string, [string, string][]>([
  ["dutch", [["ĳ", "ij"]]],
]);

type OnInsertTextParams = {
  // might need later?
  // inputType: SupportedInputType;
  // event: Event;

  // timing information
  now: number;
  // data being inserted
  data: string;
  // true if called by compositionEnd
  isCompositionEnding?: true;
  // are we on the last character of a multi character input
  lastInMultiIndex?: boolean;
  // true if oxytype is inserting this itself, not the user
  automatic?: true;
};

function logDeleteOnErrorEvent(
  inputType: DeleteInputType,
  now: number,
  charIndex: number,
): void {
  logTestEvent("input", now, {
    inputType,
    wordIndex: getActiveWordIndex(),
    charIndex,
    inputValue: getInputElementValue().inputValue,
    automatic: true,
  });
}

/**
 * Deletes input after an incorrect keypress, based on the deleteOnError config.
 * Every deletion is logged as a delete event, because the UI, live stats and
 * replay all derive the current input from the event log - editing the input
 * element without logging would desync them.
 * @param now - Timestamp of the input event that triggered the deletion
 */
function handleDeleteOnError(now: number): void {
  const deleteWholeWord =
    getMutableConfig().deleteOnError === "word" ||
    getMutableConfig().deleteOnError === "word_hard";
  const goBackAWord =
    getMutableConfig().deleteOnError === "letter_hard" ||
    getMutableConfig().deleteOnError === "word_hard";

  //the incorrect character has already been inserted and logged at this point
  const inputLength = getCurrentInput().length;

  if (inputLength > 0) {
    if (deleteWholeWord) {
      setInputElementValue("");
      logDeleteOnErrorEvent("deleteWordBackward", now, inputLength);
    } else {
      //delete the incorrect character
      replaceInputElementLastValueChar("");
      logDeleteOnErrorEvent("deleteContentBackward", now, inputLength);

      //and the one before it, so that a mistake actually costs progress
      if (inputLength > 1) {
        replaceInputElementLastValueChar("");
        logDeleteOnErrorEvent("deleteContentBackward", now, inputLength - 1);
      }
    }
  }

  //mistake on the first character of the word - the hard modes send you back
  //but only if the previous word is still in the dom (it might have scrolled
  //off), same check as the one a normal backspace does in onBeforeDelete
  if (
    goBackAWord &&
    inputLength <= 1 &&
    getActiveWordIndex() > 0 &&
    TestUI.getWordElement(getActiveWordIndex() - 1) !== null
  ) {
    //pretend its a normal backspace, not insertText
    const inputType: DeleteInputType = deleteWholeWord
      ? "deleteWordBackward"
      : "deleteContentBackward";
    goToPreviousWord(inputType);
    logDeleteOnErrorEvent(
      inputType,
      now,
      getInputElementValue().inputValue.length,
    );
  }
}

export async function onInsertText(options: OnInsertTextParams): Promise<void> {
  const { now, lastInMultiIndex, isCompositionEnding, automatic } = options;
  const { inputValue } = getInputElementValue();

  if (options.data.length > 1) {
    // remove the entire data from the input value
    setInputElementValue(inputValue.slice(0, -options.data.length));
    for (let i = 0; i < options.data.length; i++) {
      const char = options.data[i] as string;

      // then add it one by one
      await emulateInsertText({
        ...options,
        data: char,
        lastInMultiIndex: i === options.data.length - 1,
      });
    }
    return;
  }

  const charOverride = charOverrides.get(options.data);
  if (
    charOverride !== undefined &&
    TestWords.words.getCurrent()?.textWithCommit[getCurrentInput().length] !==
      options.data
  ) {
    // replace the data with the override
    setInputElementValue(
      inputValue.slice(0, -options.data.length) + charOverride,
    );
    await onInsertText({
      ...options,
      data: charOverride,
    });
    return;
  }

  const languageOverrides = languageCharOverrides.get(
    removeLanguageSize(getMutableConfig().language),
  );
  if (languageOverrides !== undefined) {
    for (const [targetChar, overrideChar] of languageOverrides) {
      if (
        options.data === targetChar &&
        TestWords.words.getCurrent()?.textWithCommit[
          getCurrentInput().length
        ] !== options.data
      ) {
        // replace the data with the override
        setInputElementValue(
          inputValue.slice(0, -options.data.length) + overrideChar,
        );
        await onInsertText({
          ...options,
          data: overrideChar,
        });
        return;
      }
    }
  }

  // input and target word
  const testInput = getCurrentInput();
  const currentWord = TestWords.words.getCurrent()?.textWithCommit ?? "";

  // if the character is visually equal, replace it with the target character
  // this ensures all future equivalence checks work correctly
  const normalizedData = normalizeDataAndUpdateInputIfNeeded(
    options.data,
    testInput,
    currentWord,
  );
  const data = normalizedData ?? options.data;

  // start if needed
  if (!isTestActive()) {
    TestLogic.startTest(now);
  }

  // helper consts
  const lastInMultiOrSingle =
    lastInMultiIndex === true || lastInMultiIndex === undefined;
  const wordIndex = getActiveWordIndex();
  const correctShiftUsed =
    getMutableConfig().oppositeShiftMode === "off"
      ? null
      : isCorrectShiftUsed();
  const commitCharacterType = getCommitCharacterType({
    data,
    inputValue: testInput,
    targetWord: currentWord,
  });

  const decision = evaluateInsert(getMutableConfig(), {
    data,
    inputValue: testInput,
    targetWord: currentWord,
    correctShiftUsed,
    nospace: commitCharacterType === "nospace",
  });
  const {
    correct,
    stopped: removeLastChar,
    visualInputOverride,
    advance: goingToNextWord,
  } = decision;
  if (correctShiftUsed === false) {
    incrementIncorrectShiftsInARow();
    if (getIncorrectShiftsInARow() >= 5) {
      showNoticeNotification("Opposite shift mode is on.", {
        important: true,
        customTitle: "Reminder",
      });
    }
  } else {
    resetIncorrectShiftsInARow();
  }

  if (getMutableConfig().keymapMode === "react") {
    flash(data, correct);
  }

  if (removeLastChar) {
    replaceInputElementLastValueChar("");
  }

  // capture DOM before goToNextWord clears it for the new word
  const inputValueAfterEvent = getInputElementValue().inputValue;

  // Log the event BEFORE goToNextWord so readers inside the navigation
  // (e.g. beforeTestWordChange's updateWordLetters, getWordBurst) see the
  // completed event in derivation. Otherwise the just-typed trigger char
  // (space/newline) is missing — visible as missing \n element in zen mode.
  logTestEvent("input", now, {
    inputType: "insertText",
    data,
    correct,
    wordIndex,
    charIndex: testInput.length,
    isCompositionEnding: isCompositionEnding ? true : undefined,
    inputStopped: removeLastChar ? true : undefined,
    automatic: automatic ? true : undefined,
    // inputValue is captured from the input element after this event (before goToNextWord clears it).
    inputValue: inputValueAfterEvent,
    commitsWord: goingToNextWord ? true : undefined,
    lastWord: wordIndex === TestWords.words.length - 1 ? true : undefined,
  });

  // this needs to be called after event logging
  WeakSpot.updateScore(data, correct);

  // delete on error
  // skipped when the input was stopped - nothing was inserted to delete
  // before the UI update so it renders the input after the deletion, in one go
  if (
    getMutableConfig().deleteOnError !== "off" &&
    !correct &&
    !removeLastChar
  ) {
    handleDeleteOnError(now);
  }

  if (lastInMultiOrSingle) {
    TestUI.afterTestTextInput(correct, visualInputOverride, goingToNextWord);
  }

  // going to next word
  let increasedWordIndex: null | boolean = null;
  let lastBurst: null | number = null;
  if (goingToNextWord) {
    const result = await goToNextWord({
      correctInsert:
        getMutableConfig().mode === "zen"
          ? true
          : testInput + data === currentWord,
      now,
    });
    lastBurst = result.lastBurst;
    increasedWordIndex = result.increasedWordIndex;
  }

  //this COULD be the next word because we are awaiting goToNextWord
  const nextWord = TestWords.words.getCurrent()?.textWithCommit ?? "";
  const doesNextWordHaveTab = /^\t+/.test(nextWord);
  const isCurrentCharTab = nextWord[getCurrentInput().length] === "\t";

  //code mode - auto insert tabs
  if (
    getMutableConfig().language.startsWith("code") &&
    correct &&
    doesNextWordHaveTab &&
    isCurrentCharTab
  ) {
    setTimeout(() => {
      void emulateInsertText({ data: "\t", now, automatic: true });
    }, 0);
  }

  if (!CompositionState.getComposing() && lastInMultiOrSingle) {
    if (
      checkIfFailedDueToDifficulty({
        data,
        testInput: testInput,
        targetWord: currentWord,
        correct,
        commitCharacterType,
      })
    ) {
      TestLogic.fail("difficulty");
    } else if (
      increasedWordIndex &&
      checkIfFailedDueToMinBurst({
        testInputWithData: testInput + data,
        currentWord,
        lastBurst,
      })
    ) {
      TestLogic.fail("min burst");
    } else if (
      checkIfFinished({
        goingToNextWord,
        testInputWithData: testInput + data,
        currentWord,
        allWordsTyped: wordIndex >= TestWords.words.length - 1,
        allWordsGenerated: areAllWordsGenerated(),
      })
    ) {
      void TestLogic.finish();
    }
  }
}

function normalizeDataAndUpdateInputIfNeeded(
  data: string,
  testInput: string,
  currentWord: string,
): string | null {
  const normalized = normalizeData(data, testInput, currentWord);
  if (normalized !== data) {
    replaceInputElementLastValueChar(normalized);
    return normalized;
  }
  return null;
}

export async function emulateInsertText(
  options: OnInsertTextParams,
): Promise<void> {
  const inputStopped = onBeforeInsertText(options.data);

  if (inputStopped) {
    return;
  }

  // default is prevented so we need to manually update the input value.
  appendToInputElementValue(options.data);

  await onInsertText(options);
}
