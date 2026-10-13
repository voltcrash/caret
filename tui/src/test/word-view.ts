import type { Config } from "@oxytype/schemas/configs";
import { splitIntoCharacters } from "@oxytype/typing-core/strings";

export type LetterState = "untyped" | "correct" | "incorrect" | "extra";

type Letter = { char: string; state: LetterState };

export type WordView = {
  letters: Letter[];
  /** A committed word that does not match its target. */
  error: boolean;
  /** The target ends a line. */
  newline: boolean;
};

export type WordViewOptions = Pick<
  Config,
  "blindMode" | "hideExtraLetters" | "indicateTypos"
> & {
  zen: boolean;
  /** The word was committed (it lies before the active word). */
  committed: boolean;
};

/** The trailing space or newline commits a word; it is never a letter. */
function stripSeparator(word: string): string {
  return word.endsWith(" ") || word.endsWith("\n") ? word.slice(0, -1) : word;
}

// Tabs keep one terminal column.
function displayChar(char: string): string {
  if (char === " ") return "_";
  if (char === "\t") return "→";
  return char;
}

/** Letter states for one word, following the web's word markup rules. */
export function buildWordView(
  target: string,
  input: string,
  options: WordViewOptions,
): WordView {
  const targetChars = splitIntoCharacters(stripSeparator(target));
  const inputChars = splitIntoCharacters(stripSeparator(input));
  const letters: Letter[] = [];

  const length = options.zen
    ? inputChars.length
    : Math.max(targetChars.length, inputChars.length);
  for (let i = 0; i < length; i++) {
    const typed = inputChars[i];
    const expected = targetChars[i];
    if (options.zen) {
      letters.push({ char: displayChar(typed ?? ""), state: "correct" });
    } else if (expected === undefined) {
      // Blind mode hides extra letters, like hideExtraLetters.
      if (options.hideExtraLetters || options.blindMode) continue;
      letters.push({ char: displayChar(typed ?? ""), state: "extra" });
    } else if (typed === undefined) {
      letters.push({ char: displayChar(expected), state: "untyped" });
    } else if (typed === expected || options.blindMode) {
      letters.push({ char: displayChar(expected), state: "correct" });
    } else {
      // Terminals cannot draw hints below letters, so "below" replaces too.
      const shown = options.indicateTypos === "off" ? expected : typed;
      letters.push({ char: displayChar(shown), state: "incorrect" });
    }
  }

  return {
    letters,
    error:
      options.committed &&
      !options.zen &&
      !options.blindMode &&
      stripSeparator(input) !== stripSeparator(target),
    newline: target.endsWith("\n") || (options.zen && input.endsWith("\n")),
  };
}
