import { splitIntoCharacters } from "../../../../ts/utils/strings";
import {
  createNewlineSpacers,
  createUntypedLetter,
  WordNodeRenderer,
} from "./letters";

const wordTemplates = new Map<string, HTMLElement>();
const MAX_TEMPLATES = 1_024;

export function clearWordTemplates(): void {
  wordTemplates.clear();
}

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
  const template = renderer === undefined ? wordTemplates.get(word) : undefined;
  if (template !== undefined) {
    const element = template.cloneNode(true) as HTMLElement;
    element.dataset["wordindex"] = `${wordIndex}`;
    parent.append(element);
    if (word.includes("\n")) parent.append(createNewlineSpacers());
    return;
  }
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
  if (renderer === undefined) {
    if (wordTemplates.size === MAX_TEMPLATES) {
      const oldest = wordTemplates.keys().next().value;
      if (oldest !== undefined) wordTemplates.delete(oldest);
    }
    wordTemplates.set(word, element.cloneNode(true) as HTMLElement);
  }
}
