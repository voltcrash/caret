import * as Hangul from "hangul-js";

import * as Strings from "../utils/strings";

export type WordLetter = {
  char: string;
  // legacy letter classes (correct, incorrect, extra, corrected, extraCorrected)
  classes: string[];
};

export type WordsHistoryItem = {
  letters: WordLetter[];
  // word was typed (legacy "nocursor" class)
  typed: boolean;
  error: boolean;
  burst: number | undefined;
  // shown on hover, spaces replaced by underscores
  input: string;
};

type LetterOptions = {
  zen: boolean;
  korean: boolean;
};

export function buildWordLetters(
  input: string | undefined,
  corrected: string | undefined,
  targetWord: string | undefined,
  options: LetterOptions,
): WordLetter[] {
  const out: WordLetter[] = [];
  // the trailing commit separator (space/newline) is structural, not a letter;
  // strip it from all three so it never renders and over-typed extras / untyped
  // tails line up correctly
  if (input?.endsWith(" ") || input?.endsWith("\n")) input = input.slice(0, -1);
  if (corrected?.endsWith(" ") || corrected?.endsWith("\n")) {
    corrected = corrected.slice(0, -1);
  }
  if (targetWord?.endsWith(" ") || targetWord?.endsWith("\n")) {
    targetWord = targetWord.slice(0, -1);
  }

  const inputChars = Strings.splitIntoCharacters(input ?? "");
  const targetChars = Strings.splitIntoCharacters(targetWord ?? "");
  const correctedChars = Strings.splitIntoCharacters(corrected ?? "");
  for (let c = 0; c < Math.max(targetChars.length, inputChars.length); c++) {
    const inputChar = inputChars[c];
    const targetChar = targetChars[c];

    const correctedChar = correctedChars[c];
    const extraCorrected: string[] = [];
    const historyWord: string = !options.korean
      ? (corrected ?? "")
      : Hangul.assemble((corrected ?? "").split(""));
    if (
      c >= targetChars.length - 1 &&
      c + 1 === inputChars.length &&
      historyWord.length > inputChars.length
    ) {
      extraCorrected.push("extraCorrected");
    }

    let displayLetter = (inputChar ?? targetChar) as string;
    if (displayLetter === " ") {
      displayLetter = "_";
    }

    if (options.zen || targetChar !== undefined) {
      if (options.zen || inputChar === targetChar) {
        if (correctedChar === inputChar || correctedChar === undefined) {
          out.push({
            char: displayLetter,
            classes: ["correct", ...extraCorrected],
          });
        } else {
          out.push({
            char: displayLetter,
            classes: ["corrected", ...extraCorrected],
          });
        }
      } else {
        if (inputChar === undefined) {
          out.push({ char: targetChar as string, classes: [] });
        } else {
          out.push({
            char: targetChar as string,
            classes: ["incorrect", ...extraCorrected],
          });
        }
      }
    } else {
      out.push({ char: displayLetter, classes: ["incorrect", "extra"] });
    }
  }
  return out;
}

export function buildWordsHistory(options: {
  inputHistory: string[];
  correctedHistory: string[];
  burstHistory: number[];
  getTargetWord: (index: number) => string;
  zen: boolean;
  timed: boolean;
  korean: boolean;
}): WordsHistoryItem[] {
  const { inputHistory, correctedHistory, burstHistory } = options;
  const items: WordsHistoryItem[] = [];

  const inputHistoryLength = inputHistory.length;
  for (let i = 0; i < inputHistoryLength + 2; i++) {
    const input = inputHistory[i];
    const target = options.getTargetWord(i);
    const corrected = options.korean
      ? Hangul.assemble((correctedHistory[i] ?? "").split(""))
      : correctedHistory[i];

    const isIncorrectWord = input !== target;
    const isLastWord = i === inputHistoryLength - 1;
    const isPartiallyCorrect = target.startsWith(input ?? "");

    const shouldShowError =
      !options.zen &&
      !(isLastWord && options.timed && isPartiallyCorrect) &&
      input !== undefined &&
      input !== "";

    let inputAttribute = input ?? "";

    if (corrected !== undefined && corrected !== "") {
      inputAttribute = corrected;
    }

    if (
      inputAttribute.length >= target.length &&
      (inputAttribute.endsWith(" ") || inputAttribute.endsWith("\n"))
    ) {
      inputAttribute = inputAttribute.slice(0, -1);
    }

    items.push({
      letters: buildWordLetters(input, corrected, target, options),
      typed: input !== "" && input !== undefined,
      error: isIncorrectWord && shouldShowError,
      burst: burstHistory[i],
      input: inputAttribute.replace(/ /g, "_"),
    });
  }

  return items;
}
