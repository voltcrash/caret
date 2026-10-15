import { setClass } from "./elements";
import { getMutableConfig } from "../../../../config/store";
import { setResultState } from "../../../../states/result";
import { getWordsElement as getWordsEl } from "../../../../states/test-dom";

export function setJoiningClass(isEnabled: boolean): void {
  const joiningScript =
    isEnabled ||
    getMutableConfig().mode === "custom" ||
    getMutableConfig().mode === "zen";
  if (joiningScript) {
    setClass(getWordsEl(), "joiningScript", true);
  } else {
    setClass(getWordsEl(), "joiningScript", false);
  }
  setResultState("joiningScript", joiningScript);
}

function canBreak(wordEl: HTMLElement): boolean {
  if (getMutableConfig().typedEffect !== "dots") return false;
  if (wordEl.className.split(/\s+/).includes("broken-joining")) return false;

  return (
    wordEl.parentElement?.className.split(/\s+/).includes("joiningScript") ??
    false
  );
}

function applyIfNeeded(wordEl: HTMLElement): void {
  if (!canBreak(wordEl)) return;

  const letters = Array.from(wordEl.querySelectorAll<HTMLElement>("letter"));
  const firstTop = Math.floor(letters[0]?.offsetTop ?? 0);
  const isWrapped = letters.some((l) => Math.floor(l.offsetTop) !== firstTop);

  if (!isWrapped) {
    const { width } = wordEl.getBoundingClientRect();
    Object.assign(wordEl.style, { width: `${width}px` });
    setClass(wordEl, "needs-wrap", false);
  } else {
    Object.assign(wordEl.style, { width: "" });
    setClass(wordEl, "needs-wrap", true);
  }
  setClass(wordEl, "broken-joining", true);
}

function reset(wordEl: HTMLElement): void {
  if (!wordEl.className.split(/\s+/).includes("broken-joining")) return;
  setClass(wordEl, "broken-joining", false);
  setClass(wordEl, "needs-wrap", false);
  Object.assign(wordEl.style, { width: "" });
}

export function setWordJoining(
  wordEl: HTMLElement,
  joiningBroken: boolean,
): void {
  joiningBroken ? applyIfNeeded(wordEl) : reset(wordEl);
}

export function updateWordJoining(key: string, wordsEl: HTMLElement): void {
  const words = Array.from(
    wordsEl.querySelectorAll<HTMLElement>(".word.typed"),
  );

  const shouldReset =
    !wordsEl.className.split(/\s+/).includes("joiningScript") ||
    getMutableConfig().typedEffect !== "dots" ||
    key === "fontFamily" ||
    key === "fontSize";

  if (shouldReset) {
    words.forEach(reset);
  }
  words.forEach(applyIfNeeded);
}
