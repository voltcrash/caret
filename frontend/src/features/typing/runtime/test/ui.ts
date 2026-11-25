// Logic callers retain their API; Words owns the imperative rendering lifecycle.
export { updateHintsPositionDebounced } from "../../components/words/hints";
export { lineState } from "../../components/words/line-state";
export {
  focusWords,
  keepWordsInputInTheCenter,
} from "../../components/words/focus";
export {
  getWordElement,
  getActiveWordElement,
} from "../../components/words/elements";
export {
  updateActiveElement,
  appendEmptyWordElement,
  addWord,
  clearWords,
  clearWordsBlur,
  getPendingWordData,
  updateWordLetters,
  highlightBadWord,
  highlightAllLettersAsCorrect,
  getActiveWordTopAndHeightWithDifferentData,
  syncReplayedWords,
} from "../../components/words/rendering";
export {
  updateWordsInputPosition,
  updateWordsWrapperHeight,
} from "../../components/words/sizing";
export { centerActiveLine } from "../../components/words/line-jumping";
export { scrollTape } from "../../components/words/tape";
export { setJoiningClass } from "../../components/words/joining";
export {
  afterTestTextInput,
  afterTestCompositionUpdate,
  afterTestDelete,
  beforeTestWordChange,
  afterTestWordChange,
  onTestStart,
  fadeOutForRestart,
  fadeInAfterRestart,
  onTestRestart,
  onTestFinish,
} from "../../components/words/lifecycle";
