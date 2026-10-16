import { getMutableConfig } from "../../../../ts/config/store";
import * as CustomText from "../custom-text";
import {
  getLastEventLog,
  getKoreanStatus,
  getResultVisible,
} from "../../../../ts/states/test";
import {
  getCorrectedWordsHistory,
  getInputHistory,
  getWordBurstHistory,
} from "@oxytype/typing-core/events/stats";
import * as TestWords from "../test-words";
import { buildWordsHistory } from "../word-markup";
import { resultState, setResultState } from "../../../../ts/states/result";

function loadWordsHistory(): boolean {
  setResultState("wordsHistory", "items", []);

  const eventLog = getLastEventLog();
  if (eventLog === null) {
    return false;
  }

  setResultState(
    "wordsHistory",
    "items",
    buildWordsHistory({
      inputHistory: getInputHistory(eventLog),
      correctedHistory: getCorrectedWordsHistory(eventLog),
      burstHistory: getWordBurstHistory(eventLog),
      getTargetWord: (i) => TestWords.words.get(i)?.textWithCommit ?? "",
      zen: getMutableConfig().mode === "zen",
      timed:
        getMutableConfig().mode === "time" ||
        (getMutableConfig().mode === "custom" &&
          CustomText.getLimitMode() === "time") ||
        (getMutableConfig().mode === "custom" &&
          CustomText.getLimitValue() === 0),
      korean: getKoreanStatus(),
    }),
  );

  return true;
}

export function toggleResultWords(noAnimation = false): void {
  if (!getResultVisible()) return;

  const slideDuration = noAnimation ? 0 : 250;
  if (!resultState.wordsHistory.visible) {
    if (resultState.wordsHistory.items.length === 0) {
      loadWordsHistory();
    }
    setResultState("wordsHistory", { visible: true, slideDuration });
  } else {
    setResultState("wordsHistory", { visible: false, slideDuration });
  }
}
