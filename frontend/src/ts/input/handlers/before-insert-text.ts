import { shouldBlockInsertion } from "@oxytype/typing-core/input/engine";
import { getMutableConfig } from "../../config/store";
import * as TestUI from "../../test/test-ui";
import * as TestWords from "../../test/test-words";
import { isFunboxActiveWithProperty } from "../../test/funbox/list";
import { getInputElementValue } from "../input-element";
import { isAwaitingNextWord } from "../state";
import * as SlowTimer from "../../states/slow-timer";
import {
  isTestRestarting,
  getActiveWordIndex,
  isResultCalculating,
  wordsHaveNewline,
} from "../../states/test";
import { shouldGoToNextWord } from "../helpers/validation";
import { getCommitCharacterType, normalizeData } from "../helpers/util";
import { getCurrentInput } from "../../test/events/data";

/**
 * Handles logic before inserting text into the input element.
 * @param data - The text data to be inserted.
 * @returns Whether to prevent the default insertion behavior.
 */
export function onBeforeInsertText(data: string): boolean {
  if (isTestRestarting()) {
    return true;
  }

  if (isAwaitingNextWord()) {
    return true;
  }

  if (isResultCalculating()) {
    return true;
  }

  const { inputValue } = getInputElementValue();
  const currentWordObj = TestWords.words.getCurrent();
  const currentWordTextWithCommit = currentWordObj?.textWithCommit ?? "";
  const currentWordTextDisplay = currentWordObj?.display ?? "";

  //normalize visually-equivalent chars (e.g. IME U+3000 space) to the target
  //char, matching onInsertText, so commit classification is consistent
  data = normalizeData(data, inputValue, currentWordTextWithCommit);

  const commitCharacterType = getCommitCharacterType({
    data,
    inputValue,
    targetWord: currentWordTextWithCommit,
  });

  if (
    shouldBlockInsertion(getMutableConfig(), {
      data,
      inputValue,
      targetWord: currentWordTextWithCommit,
      nospace: isFunboxActiveWithProperty("nospace"),
      hasNewline: wordsHaveNewline(),
    })
  ) {
    return true;
  }
  const goingToNextWord = shouldGoToNextWord({
    data,
    inputValue,
    targetWord: currentWordTextWithCommit,
    commitCharacterType,
  });

  // prevent the word from jumping to the next line if the word is too long
  // this will not work for the first word of each line, but that has a low chance of happening
  const dataIsNotFalsy = data !== null && data !== "";
  const inputIsLongerThanOrEqualToWord =
    getCurrentInput().length >= currentWordTextDisplay.length;

  // multi character data (swipe typing, " word" from android keyboards, paste)
  // is split up and every character runs through this check on its own. as a
  // whole it would look like it overflows the line and get dropped
  const isMultiCharacter = data.length > 1;

  if (
    !SlowTimer.get() && // don't do this check if slow timer is active
    dataIsNotFalsy &&
    !isMultiCharacter &&
    !getMutableConfig().blindMode &&
    !getMutableConfig().hideExtraLetters &&
    !getMutableConfig().deleteOnError.includes("hard") &&
    inputIsLongerThanOrEqualToWord &&
    !goingToNextWord &&
    getMutableConfig().mode !== "zen"
  ) {
    // make sure to only check this when really necessary
    // because this check is expensive (causes layout reflows)

    // if there is pending word data, we need to account for that
    const pendingWordData = TestUI.pendingWordData.get(getActiveWordIndex());
    const { top: topAfterAppend, height: heightAfterAppend } =
      TestUI.getActiveWordTopAndHeightWithDifferentData(
        (pendingWordData ?? inputValue) + data,
      );
    if (topAfterAppend > TestUI.activeWordTop) {
      //word jumped to next line
      return true;
    }
    if (heightAfterAppend > TestUI.activeWordHeight) {
      // letters wrapped to next line
      return true;
    }
  }

  return false;
}
