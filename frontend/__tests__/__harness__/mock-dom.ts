import { setTestElements } from "../../src/ts/states/test-dom";

// Stand in for TestPage refs in logic-only tests. DOM fixtures may replace these.
setTestElements({
  words: document.createElement("div"),
  wordsWrapper: document.createElement("div"),
  wordsInput: document.createElement("textarea"),
  caret: document.createElement("div"),
  paceCaret: document.createElement("div"),
  typingTest: document.createElement("div"),
  keyboardProxy: document.createElement("input"),
});
