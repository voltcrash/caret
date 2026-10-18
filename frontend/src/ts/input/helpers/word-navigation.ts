import { getPreviousWordInput } from "@oxytype/typing-core/input/engine";
import { getMutableConfig } from "../../config/store";
import * as TestUI from "../../../features/typing/runtime/test-ui";
import * as PaceCaret from "../../../features/typing/runtime/pace-caret";
import {
  decreaseActiveWordIndex,
  getActiveWordIndex,
  increaseActiveWordIndex,
} from "../../states/test";
import * as TestLogic from "../../../features/typing/runtime/test-logic";
import * as TestWords from "../../../features/typing/runtime/test-words";
import {
  getActiveFunboxesWithFunction,
  isFunboxActiveWithProperty,
} from "../../../features/typing/runtime/funbox/list";
import * as Funbox from "../../../features/typing/runtime/funbox/funbox";
import { showLoaderBar, hideLoaderBar } from "../../states/loader-bar";
import { setInputElementValue } from "../input-element";
import { setAwaitingNextWord } from "../state";
import { DeleteInputType } from "./input-type";
import { getWordBurst } from "@oxytype/typing-core/events/stats";
import {
  buildEventLog,
  getInputForWord,
} from "../../../features/typing/runtime/events/data";

type GoToNextWordParams = {
  correctInsert: boolean;
  now: number;
};

type GoToNextWordReturn = {
  increasedWordIndex: boolean;
  lastBurst: number | null;
};

export async function goToNextWord({
  correctInsert,
  now,
}: GoToNextWordParams): Promise<GoToNextWordReturn> {
  const ret: GoToNextWordReturn = {
    increasedWordIndex: false,
    lastBurst: null,
  };

  TestUI.beforeTestWordChange("forward", correctInsert);

  for (const fb of getActiveFunboxesWithFunction("handleSpace")) {
    fb.functions.handleSpace();
  }

  if (
    getMutableConfig().minBurst !== "off" ||
    getMutableConfig().liveBurstStyle !== "off"
  ) {
    const burst = getWordBurst(buildEventLog(), getActiveWordIndex(), now);
    ret.lastBurst = burst;
  }

  PaceCaret.handleSpace(
    correctInsert,
    TestWords.words.getCurrent()?.textWithCommit ?? "",
  );

  const nextWord = TestWords.words.get(getActiveWordIndex() + 1)?.text;
  if (nextWord !== undefined) Funbox.toggleScript(nextWord);

  const lastWord = getActiveWordIndex() >= TestWords.words.length - 1;
  if (lastWord) {
    setAwaitingNextWord(true);
    showLoaderBar();
    await TestLogic.addWord();
    hideLoaderBar();
    setAwaitingNextWord(false);
  } else {
    void TestLogic.addWord();
  }

  if (
    getActiveWordIndex() < TestWords.words.length - 1 ||
    getMutableConfig().mode === "zen"
  ) {
    ret.increasedWordIndex = true;
    increaseActiveWordIndex();
  }

  setInputElementValue("");
  void TestUI.afterTestWordChange("forward", ret.lastBurst);

  return ret;
}

export function goToPreviousWord(inputType: DeleteInputType): void {
  if (getActiveWordIndex() === 0) {
    setInputElementValue("");
    return;
  }

  TestUI.beforeTestWordChange("back", null);

  decreaseActiveWordIndex();

  const word = TestWords.words.get(getActiveWordIndex())?.text;
  if (word !== undefined) Funbox.toggleScript(word);

  const nospaceEnabled = isFunboxActiveWithProperty("nospace");

  setInputElementValue(
    getPreviousWordInput(
      getInputForWord(getActiveWordIndex()),
      inputType,
      nospaceEnabled,
    ),
  );
  void TestUI.afterTestWordChange("back");
}
