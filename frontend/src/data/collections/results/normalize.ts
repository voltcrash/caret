import { ResultMinified } from "@caret/schemas/results";
import { Mode } from "@caret/schemas/shared";

import { SnapshotResult } from "../../../ts/constants/default-snapshot";

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
  const duration = getCompletedDuration(result);
  const timeTyping = calcTimeTyping(result, duration);
  const words = Math.round((result.wpm / 60) * duration);

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
    words: Number.isFinite(words) ? Math.max(0, words) : 0,
    dayTimestamp: resultDate.getTime(),
  } as SnapshotResult<Mode>;
}

function getCompletedDuration(result: ResultMinified): number {
  if (result.testDuration !== undefined) {
    return parseFloat(String(result.testDuration)); // Legacy durations may be strings.
  }
  if (result.mode === "time") return parseInt(result.mode2);
  if (result.mode === "words") {
    return (parseInt(result.mode2) / result.wpm) * 60;
  }
  return 0;
}

function calcTimeTyping(result: ResultMinified, duration: number): number {
  let tt = duration;
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
