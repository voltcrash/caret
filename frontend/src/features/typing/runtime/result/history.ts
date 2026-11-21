import { peekConfig } from "#shared/config/store.ts";
import * as CustomText from "../content/custom-text";
import { getResultVisible } from "#shared/states/test.ts";
import { getLastEventLog } from "#features/typing/state/event-log.ts";
import { getKoreanStatus } from "#features/typing/state/composition.ts";
import {
  getCorrectedWordsHistory,
  getInputHistory,
  getWordBurstHistory,
} from "#shared/engine/analysis.client.ts";
import * as TestWords from "../test/words";
import { buildWordsHistory } from "../word-markup";
import { resultState, setResultState } from "../../state/result";

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
      zen: peekConfig().mode === "zen",
      timed:
        peekConfig().mode === "time" ||
        (peekConfig().mode === "custom" &&
          CustomText.getLimitMode() === "time") ||
        (peekConfig().mode === "custom" && CustomText.getLimitValue() === 0),
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
