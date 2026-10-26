import { ResultMinified } from "@caret/schemas/results";
import { Mode } from "@caret/schemas/shared";

import { SnapshotResult } from "../../constants/default-snapshot";

export function normalizeResult(
  result: ResultMinified | SnapshotResult<Mode>,
  knownTagIds?: Set<string>,
): SnapshotResult<Mode> {
  const resultDate = new Date(result.timestamp);
  resultDate.setSeconds(0);
  resultDate.setMinutes(0);
  resultDate.setHours(0);
  resultDate.setMilliseconds(0);
  // Estimate historical durations before stripped fields receive defaults.
  const timeTyping = calcTimeTyping(result);

  //results strip default values, add them back
  result.client ??= "web";
  result.bailedOut ??= false;
  result.blindMode ??= false;
  result.lazyMode ??= false;
  result.difficulty ??= "normal";
  result.funbox ??= [];
  result.language ??= "english";
  result.numbers ??= false;
  result.punctuation ??= false;
  result.quoteLength ??= -1;
  result.restartCount ??= 0;
  result.incompleteTestSeconds ??= 0;
  result.afkDuration ??= 0;

  result.tags ??= [];
  if (knownTagIds !== undefined) {
    result.tags = result.tags.filter((tagId) => knownTagIds.has(tagId));
  }
  result.isPb ??= false;
  return {
    ...result,
    timeTyping,
    words: Math.round((result.wpm / 60) * result.testDuration),
    dayTimestamp: resultDate.getTime(),
  } as SnapshotResult<Mode>;
}

function calcTimeTyping(result: ResultMinified): number {
  let tt = 0;
  if (
    result.testDuration === undefined &&
    result.mode2 !== "custom" &&
    result.mode2 !== "zen"
  ) {
    //test finished before testDuration field was introduced - estimate
    if (result.mode === "time") {
      tt = parseInt(result.mode2);
    } else if (result.mode === "words") {
      tt = (parseInt(result.mode2) / result.wpm) * 60;
    }
  } else {
    tt = parseFloat(result.testDuration as unknown as string); //legacy results could have a string here
  }
  if (result.incompleteTestSeconds !== undefined) {
    tt += result.incompleteTestSeconds;
  } else if (
    result.testDuration === undefined &&
    result.restartCount !== undefined &&
    result.restartCount > 0
  ) {
    tt += (tt / 4) * result.restartCount;
  }
  tt -= result.afkDuration ?? 0;
  return Number.isFinite(tt) ? Math.max(0, tt) : 0;
}
