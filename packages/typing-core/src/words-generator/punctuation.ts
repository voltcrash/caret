import { findSingleFunboxWithFunction } from "../active-funboxes";
import * as Arrays from "../arrays";
import * as Strings from "../strings";
import type { WordsGeneratorDeps } from "./types";

type PunctuateWord = (
  previousWord: string | undefined,
  currentWord: string,
  index: number,
  maxindex: number,
) => Promise<string>;

function shouldCapitalize(lastChar: string): boolean {
  return /[?!.؟]/.test(lastChar);
}

export function createPunctuation(
  deps: WordsGeneratorDeps,
  random: () => number,
): PunctuateWord {
  const config = deps.getConfig;

  let spanishSentenceTracker = "";
  async function punctuateWord(
    previousWord: string | undefined,
    currentWord: string,
    index: number,
    maxindex: number,
  ): Promise<string> {
    let word = currentWord;

    const currentLanguage = config().language.split("_")[0];

    const lastChar =
      previousWord !== undefined
        ? Strings.getLastChar(previousWord)
        : undefined;

    const funbox = findSingleFunboxWithFunction(
      deps.getActiveFunboxes(),
      "punctuateWord",
    );
    if (funbox) {
      return funbox.functions.punctuateWord(word);
    }
    if (
      currentLanguage !== "code" &&
      currentLanguage !== "georgian" &&
      (index === 0 || (lastChar !== undefined && shouldCapitalize(lastChar)))
    ) {
      //always capitalise the first word or if there was a dot unless using a code alphabet or the Georgian language

      word = Strings.capitalizeFirstLetterOfEachWord(word);

      if (currentLanguage === "turkish") {
        word = word.replace(/I/g, "İ");
      }

      if (currentLanguage === "spanish") {
        const rand = random();
        if (rand > 0.9) {
          word = `¿${word}`;
          spanishSentenceTracker = "?";
        } else if (rand > 0.8) {
          word = `¡${word}`;
          spanishSentenceTracker = "!";
        }
      }
    } else if (
      (random() < 0.1 &&
        lastChar !== "." &&
        lastChar !== "," &&
        index !== maxindex - 2) ||
      index === maxindex - 1
    ) {
      if (currentLanguage === "spanish") {
        if (spanishSentenceTracker === "?" || spanishSentenceTracker === "!") {
          word += spanishSentenceTracker;
          spanishSentenceTracker = "";
        }
      } else {
        const rand = random();
        if (rand <= 0.8) {
          if (currentLanguage === "kurdish") {
            word += ".";
          } else if (
            currentLanguage === "nepali" ||
            currentLanguage === "bangla" ||
            currentLanguage === "hindi"
          ) {
            word += "।";
          } else if (
            currentLanguage === "japanese" ||
            currentLanguage === "chinese"
          ) {
            word += "。";
          } else {
            word += ".";
          }
        } else if (rand > 0.8 && rand < 0.9) {
          if (currentLanguage === "french") {
            word = "?";
          } else if (
            currentLanguage === "arabic" ||
            currentLanguage === "persian" ||
            currentLanguage === "urdu" ||
            currentLanguage === "kurdish"
          ) {
            word += "؟";
          } else if (currentLanguage === "greek") {
            word += ";";
          } else if (
            currentLanguage === "japanese" ||
            currentLanguage === "chinese"
          ) {
            word += "？";
          } else {
            word += "?";
          }
        } else {
          if (currentLanguage === "french") {
            word = "!";
          } else if (
            currentLanguage === "japanese" ||
            currentLanguage === "chinese"
          ) {
            word += "！";
          } else {
            word += "!";
          }
        }
      }
    } else if (
      random() < 0.01 &&
      lastChar !== "," &&
      lastChar !== "." &&
      currentLanguage !== "russian"
    ) {
      word = `"${word}"`;
    } else if (
      random() < 0.011 &&
      lastChar !== "," &&
      lastChar !== "." &&
      currentLanguage !== "russian" &&
      currentLanguage !== "ukrainian" &&
      currentLanguage !== "slovak"
    ) {
      word = `'${word}'`;
    } else if (random() < 0.012 && lastChar !== "," && lastChar !== ".") {
      if (currentLanguage === "code") {
        const r = random();
        const brackets = ["()", "{}", "[]", "<>"];

        // add `word` in javascript
        if (config().language.startsWith("code_javascript")) {
          brackets.push("``");
        }

        const bracketIndex = Math.floor(r * brackets.length);
        const bracket = brackets[bracketIndex] as string;

        word = `${bracket[0]}${word}${bracket[1]}`;
      } else if (
        currentLanguage === "japanese" ||
        currentLanguage === "chinese"
      ) {
        word = `（${word}）`;
      } else {
        word = `(${word})`;
      }
    } else if (
      random() < 0.013 &&
      lastChar !== "," &&
      lastChar !== "." &&
      lastChar !== ";" &&
      lastChar !== "؛" &&
      lastChar !== ":" &&
      lastChar !== "；" &&
      lastChar !== "："
    ) {
      if (currentLanguage === "french") {
        word = ":";
      } else if (currentLanguage === "chinese") {
        word += "：";
      } else {
        word += ":";
      }
    } else if (
      random() < 0.014 &&
      lastChar !== "," &&
      lastChar !== "." &&
      previousWord !== "-"
    ) {
      word = "-";
    } else if (
      random() < 0.015 &&
      lastChar !== "," &&
      lastChar !== "." &&
      lastChar !== ";" &&
      lastChar !== "؛" &&
      lastChar !== "；" &&
      lastChar !== "："
    ) {
      if (currentLanguage === "french") {
        word = ";";
      } else if (currentLanguage === "greek") {
        // Normally U+00B7 ('middle dot' or 'ano teleia') would be used here.
        // However, a) it has fallen into disuse in contemporary times and
        // b) there isn't a dedicated key on a keyboard to input it
        word = ".";
      } else if (
        currentLanguage === "arabic" ||
        currentLanguage === "kurdish"
      ) {
        word += "؛";
      } else if (currentLanguage === "chinese") {
        word += "；";
      } else {
        word += ";";
      }
    } else if (random() < 0.2 && lastChar !== ",") {
      if (
        currentLanguage === "arabic" ||
        currentLanguage === "urdu" ||
        currentLanguage === "persian" ||
        currentLanguage === "kurdish"
      ) {
        word += "،";
      } else if (currentLanguage === "japanese") {
        word += "、";
      } else if (currentLanguage === "chinese") {
        word += "，";
      } else {
        word += ",";
      }
    } else if (random() < 0.25 && currentLanguage === "code") {
      const specials = ["{", "}", "[", "]", "(", ")", ";", "=", "+", "%", "/"];
      const specialsC = [
        "{",
        "}",
        "[",
        "]",
        "(",
        ")",
        ";",
        "=",
        "+",
        "%",
        "/",
        "/*",
        "*/",
        "//",
        "!=",
        "==",
        "<=",
        ">=",
        "||",
        "&&",
        "<<",
        ">>",
        "%=",
        "&=",
        "*=",
        "++",
        "+=",
        "--",
        "-=",
        "/=",
        "^=",
        "|=",
      ];

      if (
        (config().language.startsWith("code_c") &&
          !config().language.startsWith("code_css")) ||
        config().language.startsWith("code_arduino")
      ) {
        word = Arrays.randomElementFromArray(specialsC);
      } else {
        if (config().language.startsWith("code_javascript")) {
          word = Arrays.randomElementFromArray([...specials, "`"]);
        } else {
          word = Arrays.randomElementFromArray(specials);
        }
      }
    } else if (
      random() < 0.5 &&
      currentLanguage === "english" &&
      (await deps.transforms.englishPunctuation.check(word))
    ) {
      word = await applyEnglishPunctuationToWord(word);
    }

    if (word.includes("\t")) {
      word = word.replace(/\t/g, "");
      word += "\t";
    }
    if (word.includes("\n")) {
      word = word.replace(/\n/g, "");
      word += "\n";
    }

    return word;
  }

  async function applyEnglishPunctuationToWord(word: string): Promise<string> {
    return deps.transforms.englishPunctuation.replace(word);
  }

  return punctuateWord;
}
