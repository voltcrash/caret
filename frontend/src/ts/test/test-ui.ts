// Logic callers retain their API; Words owns the imperative rendering lifecycle.
export { updateHintsPositionDebounced } from "../components/pages/test/words/hints";
export {
  activeWordTop,
  activeWordHeight,
} from "../components/pages/test/words/line-state";
export {
  focusWords,
  keepWordsInputInTheCenter,
} from "../components/pages/test/words/focus";
export {
  getWordElement,
  getActiveWordElement,
} from "../components/pages/test/words/elements";
export {
  updateActiveElement,
  appendEmptyWordElement,
  addWord,
  clearWords,
  clearWordsBlur,
  pendingWordData,
  updateWordLetters,
  highlightBadWord,
  highlightAllLettersAsCorrect,
  getActiveWordTopAndHeightWithDifferentData,
} from "../components/pages/test/words/rendering";
export {
  updateWordsInputPosition,
  updateWordsWrapperHeight,
} from "../components/pages/test/words/sizing";
export { centerActiveLine } from "../components/pages/test/words/line-jumping";
export { scrollTape } from "../components/pages/test/words/tape";
export { setJoiningClass } from "../components/pages/test/words/joining";
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
} from "../components/pages/test/words/lifecycle";
