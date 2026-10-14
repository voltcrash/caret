import { splitIntoCharacters } from "../../../../utils/strings";
import {
  createNewlineSpacers,
  createUntypedLetter,
  WordNodeRenderer,
} from "./letters";

export function buildInitialWordNodes(
  word: string,
  wordIndex: number,
  renderer?: WordNodeRenderer,
): DocumentFragment {
  const nodes = document.createDocumentFragment();
  appendInitialWordNodes(nodes, word, wordIndex, renderer);
  return nodes;
}

export function appendInitialWordNodes(
  parent: HTMLElement | DocumentFragment,
  word: string,
  wordIndex: number,
  renderer?: WordNodeRenderer,
): void {
  const element = document.createElement("div");
  element.className = "word";
  element.dataset["wordindex"] = `${wordIndex}`;
  let newlineAfter = false;
  for (const char of splitIntoCharacters(word)) {
    const letter = createUntypedLetter(char, renderer);
    if (letter !== undefined) element.append(letter);
    if (renderer === undefined && char === "\n") newlineAfter = true;
  }
  parent.append(element);
  if (newlineAfter) parent.append(createNewlineSpacers());
}
