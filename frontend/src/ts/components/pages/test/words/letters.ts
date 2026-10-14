import { createWordIcon } from "./icons";

export type WordNodeRenderer = (char: string) => Node | undefined;

export function createLetter(
  content: string | Node,
  classes = "",
): HTMLElement {
  const letter = document.createElement("letter");
  if (classes !== "") letter.className = classes;
  if (typeof content === "string") letter.textContent = content;
  else letter.append(content);
  return letter;
}

export function displayTypedChar(char: string | undefined): string | Node {
  if (char === " ") return "_";
  if (char === "\t") {
    return createWordIcon({
      icon: "fa-long-arrow-alt-right",
      fixedWidth: true,
    });
  }
  if (char === "\n") {
    return createWordIcon({
      icon: "fa-level-down-alt",
      fixedWidth: true,
      class: "fa-rotate-90",
    });
  }
  return char ?? "";
}

export function createUntypedLetter(
  char: string,
  renderer?: WordNodeRenderer,
): HTMLElement | undefined {
  if (renderer !== undefined) {
    const content = renderer(char);
    return content === undefined ? undefined : createLetter(content);
  }
  if (char === "\t" || char === "\n") {
    return createLetter(
      displayTypedChar(char),
      char === "\t" ? "tabChar" : "nlChar",
    );
  }
  return createLetter(char);
}

export function createNewlineSpacers(): DocumentFragment {
  const spacers = document.createDocumentFragment();
  for (const className of ["beforeNewline", "newline", "afterNewline"]) {
    const spacer = document.createElement("div");
    spacer.className = className;
    spacers.append(spacer);
  }
  return spacers;
}
