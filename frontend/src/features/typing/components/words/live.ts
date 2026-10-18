import type { Config } from "@oxytype/schemas/configs";
import { splitIntoCharacters } from "../../../../ts/utils/strings";
import {
  createLetter,
  createUntypedLetter,
  displayTypedChar,
  WordNodeRenderer,
} from "./letters";

export function buildLiveWordNodes(options: {
  currentWord: string | undefined;
  input: string;
  compositionData: string;
  zen: boolean;
  indicateTypos: Config["indicateTypos"];
  compositionDisplay: Config["compositionDisplay"];
  getWordNode?: WordNodeRenderer;
}): {
  nodes: DocumentFragment;
  hintIndices: number[][];
  newlineafter: boolean;
} {
  const {
    currentWord,
    input,
    compositionData,
    zen,
    indicateTypos,
    compositionDisplay,
    getWordNode,
  } = options;
  const nodes = document.createDocumentFragment();
  const hintIndices: number[][] = [];
  let newlineafter = false;
  if (zen) {
    for (const char of input) {
      const control = char === "\t" || char === "\n";
      const letter = createLetter(
        control ? displayTypedChar(char) : char,
        control ? `${char === "\t" ? "tabChar" : "nlChar"} correct` : "correct",
      );
      if (control) letter.style.opacity = "0";
      nodes.append(letter);
      if (char === "\n") newlineafter = true;
    }
    if (input === "" && compositionData === "") {
      nodes.append(createLetter("_", "invisible"));
    }
    for (const char of compositionData) {
      nodes.append(createLetter(char, "dead"));
    }
    return { nodes, hintIndices, newlineafter };
  }

  const inputChars = splitIntoCharacters(input);
  const targetChars = splitIntoCharacters(currentWord ?? "");
  for (let i = 0; i < inputChars.length; i++) {
    const target = targetChars[i];
    const typed = inputChars[i];
    const controlClass =
      getWordNode === undefined
        ? target === "\t"
          ? "tabChar"
          : target === "\n"
            ? "nlChar"
            : ""
        : "";
    const targetContent =
      getWordNode !== undefined && target !== undefined
        ? (getWordNode(target) ?? target)
        : target === "\t" || target === "\n"
          ? displayTypedChar(target)
          : (target ?? "");
    if (target === typed) {
      nodes.append(
        createLetter(targetContent, `correct ${controlClass}`.trim()),
      );
    } else if (target === undefined) {
      nodes.append(createLetter(displayTypedChar(typed), "incorrect extra"));
    } else {
      nodes.append(
        createLetter(
          indicateTypos === "replace" || indicateTypos === "both"
            ? displayTypedChar(typed ?? target)
            : targetContent,
          `incorrect ${controlClass}`.trim(),
        ),
      );
      if (indicateTypos === "below" || indicateTypos === "both") {
        const last = hintIndices[hintIndices.length - 1];
        if (last?.[last.length - 1] === i - 1) last.push(i);
        else hintIndices.push([i]);
      }
    }
  }
  for (let i = 0; i < compositionData.length; i++) {
    const char = compositionData[i];
    const target = targetChars[input.length + i];
    const content =
      compositionDisplay === "replace"
        ? char === " "
          ? "_"
          : char
        : (target ?? char);
    nodes.append(
      createLetter(content ?? "", char === target ? "dead correct" : "dead"),
    );
  }
  for (
    let i = inputChars.length + compositionData.length;
    i < targetChars.length;
    i++
  ) {
    const char = targetChars[i];
    if (char === undefined) continue;
    const letter = createUntypedLetter(char, getWordNode);
    if (letter !== undefined) nodes.append(letter);
  }
  return { nodes, hintIndices, newlineafter };
}
