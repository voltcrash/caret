// Logic callers retain their API; Words owns the imperative rendering lifecycle.
export { updateHintsPositionDebounced } from "../../../ts/components/pages/test/words/hints";
export {
  activeWordTop,
  activeWordHeight,
} from "../../../ts/components/pages/test/words/line-state";
export {
  focusWords,
  keepWordsInputInTheCenter,
} from "../../../ts/components/pages/test/words/focus";
export {
  getWordElement,
  getActiveWordElement,
} from "../../../ts/components/pages/test/words/elements";
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
} from "../../../ts/components/pages/test/words/rendering";
export {
  updateWordsInputPosition,
  updateWordsWrapperHeight,
} from "../../../ts/components/pages/test/words/sizing";
export { centerActiveLine } from "../../../ts/components/pages/test/words/line-jumping";
export { scrollTape } from "../../../ts/components/pages/test/words/tape";
export { setJoiningClass } from "../../../ts/components/pages/test/words/joining";
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
} from "../../../ts/components/pages/test/words/lifecycle";
