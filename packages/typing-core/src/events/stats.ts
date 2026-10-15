import { getTargetWord, inferActiveWordIndex } from "./stats/characters";
import {
  getTimerBoundaryLabels,
  getTimerBoundaries,
  getLaggedTimerBoundaries,
} from "./stats/timing";

export const __testing = {
  getTimerBoundaries,
  getLaggedTimerBoundaries,
  getTimerBoundaryLabels,
  getTargetWord,
  inferActiveWordIndex,
};

export {
  getTimerBoundaryLabels,
  getStartToFirstKeypressMs,
  getLastKeypressToEndMs,
  getTestDurationMs,
  getDateBasedTestDurationMs,
} from "./stats/timing";

export { getWordBurst, getWordBurstHistory } from "./stats/bursts";

export {
  getKeypressSpacing,
  getKeypressOverlap,
  getKeypressDurations,
} from "./stats/key-timing";

export { getChars, getAccuracy } from "./stats/characters";

export {
  getInputHistory,
  getMissedWords,
  getCorrectedWordsHistory,
} from "./stats/word-history";

export {
  getKeypressesPerSecond,
  getBurstHistory,
  getWordIndexesForSecond,
  getErrorCountHistory,
  getAfkDuration,
  getIncompleteTestSeconds,
} from "./stats/intervals";

export { getWpmHistory, getRawHistory } from "./stats/speed-history";
