import type { Config } from "@caret/schemas/configs";
import { splitIntoCharacters } from "../../../../ts/utils/strings";
import { createLetter, displayTypedChar, WordNodeRenderer } from "./letters";

type LiveWordOptions = {
  currentWord: string | undefined;
  input: string;
  compositionData: string;
  zen: boolean;
  indicateTypos: Config["indicateTypos"];
  compositionDisplay: Config["compositionDisplay"];
  getWordNode?: WordNodeRenderer;
};

type LiveWordResult = {
  hintIndices: number[][];
  newlineafter: boolean;
};

type AppendLetter = (
  content: string | Node,
  classes?: string,
  opacity?: string,
) => void;

function renderLiveWord(
  options: LiveWordOptions,
  append: AppendLetter,
): LiveWordResult {
  const {
    currentWord,
    input,
    compositionData,
    zen,
    indicateTypos,
    compositionDisplay,
    getWordNode,
  } = options;
  const hintIndices: number[][] = [];
  let newlineafter = false;
  if (zen) {
    for (const char of input) {
      const control = char === "\t" || char === "\n";
      append(
        control ? displayTypedChar(char) : char,
        control ? `${char === "\t" ? "tabChar" : "nlChar"} correct` : "correct",
        control ? "0" : "",
      );
      if (char === "\n") newlineafter = true;
    }
    if (input === "" && compositionData === "") {
      append("_", "invisible");
    }
    for (const char of compositionData) {
      append(char, "dead");
    }
    return { hintIndices, newlineafter };
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
      append(targetContent, `correct ${controlClass}`.trim());
    } else if (target === undefined) {
      append(displayTypedChar(typed), "incorrect extra");
    } else {
      append(
        indicateTypos === "replace" || indicateTypos === "both"
          ? displayTypedChar(typed ?? target)
          : targetContent,
        `incorrect ${controlClass}`.trim(),
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
    append(content ?? "", char === target ? "dead correct" : "dead");
  }
  for (
    let i = inputChars.length + compositionData.length;
    i < targetChars.length;
    i++
  ) {
    const char = targetChars[i];
    if (char === undefined) continue;
    if (getWordNode !== undefined) {
      const content = getWordNode(char);
      if (content !== undefined) append(content);
    } else {
      append(
        char === "\t" || char === "\n" ? displayTypedChar(char) : char,
        char === "\t" ? "tabChar" : char === "\n" ? "nlChar" : "",
      );
    }
  }
  return { hintIndices, newlineafter };
}

export function buildLiveWordNodes(options: LiveWordOptions): LiveWordResult & {
  nodes: DocumentFragment;
} {
  const nodes = document.createDocumentFragment();
  const result = renderLiveWord(options, (content, classes, opacity = "") => {
    const letter = createLetter(content, classes);
    if (opacity !== "") letter.style.opacity = opacity;
    nodes.append(letter);
  });
  return { nodes, ...result };
}

/** Keep unchanged letters in place; edits usually change just one class. */
export function updateLiveWordNodes(
  word: HTMLElement,
  options: LiveWordOptions,
): LiveWordResult {
  let next = word.firstChild;
  const result = renderLiveWord(
    options,
    (content, classes = "", opacity = "") => {
      const previous = next;
      next = next?.nextSibling ?? null;
      if (previous instanceof HTMLElement && previous.localName === "letter") {
        if (typeof content === "string") {
          if (
            previous.textContent !== content ||
            previous.childElementCount !== 0
          ) {
            previous.textContent = content;
          }
        } else {
          previous.replaceChildren(content);
        }
        if (previous.className !== classes) {
          if (classes === "") previous.removeAttribute("class");
          else previous.className = classes;
        }
        if (previous.style.opacity !== opacity) {
          if (opacity === "") previous.removeAttribute("style");
          else previous.style.opacity = opacity;
        }
      } else {
        const letter = createLetter(content, classes);
        if (opacity !== "") letter.style.opacity = opacity;
        if (previous === null) word.append(letter);
        else word.replaceChild(letter, previous);
      }
    },
  );
  // Remove extra letters and old hints before the caller rebuilds hints.
  while (next !== null) {
    const previous = next;
    next = next.nextSibling;
    word.removeChild(previous);
  }
  return result;
}
