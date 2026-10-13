import { Language } from "@oxytype/schemas/languages";

export function hasKoreanCharacters(text: string): boolean {
  return /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/.test(
    text,
  );
}

/**
 * Removes accents from a string.
 * https://ricardometring.com/javascript-replace-special-characters
 * @param str The input string.
 * @returns A new string with accents removed.
 */
export function replaceSpecialChars(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents
}

/**
 * Returns the last character of a string.
 * @param word The input string.
 * @returns The last character of the input string, or an empty string if the input is empty.
 */
export function getLastChar(word: string): string {
  if (word === undefined) return "";
  return word.charAt(word.length - 1);
}

/**
 * Replaces a character at a specific index in a string.
 * @param str The input string.
 * @param index The index at which to replace the character.
 * @param chr The character to insert at the specified index.
 * @returns A new string with the character at the specified index replaced.
 */
export function replaceCharAt(str: string, index: number, chr: string): string {
  if (index > str.length - 1) return str;
  return str.substring(0, index) + chr + str.substring(index + 1);
}

/**
 * Capitalizes the first letter of each word in a string.
 * @param str The input string.
 * @returns A new string with the first letter of each word capitalized.
 */
export function capitalizeFirstLetterOfEachWord(str: string): string {
  return str
    .split(/ +/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

/**
 * Removes the size indicator from a language string.
 * @param language The language string.
 * @returns The language string with the size indicator removed.
 */
export function removeLanguageSize(language: Language): Language {
  return language.replace(/_\d*k$/g, "") as Language;
}

export function cleanTypographySymbols(textToClean: string): string {
  const specials = {
    "“": '"', // &ldquo;	&#8220;
    "”": '"', // &rdquo;	&#8221;
    "„": '"', // &bdquo;	&#8222;
    "’": "'", // &lsquo;	&#8216;
    "‘": "'", // &rsquo;	&#8217;
    ",": ",", // &sbquo;	&#8218;
    "—": "-", // &mdash;  &#8212;
    "…": "...", // &hellip; &#8230;
    "«": "<<",
    "»": ">>",
    "–": "-",
    " ": " ",
    " ": " ",
    " ": " ",
    "᾽": "'",
  };
  return textToClean.replace(
    /[“”’‘—,…«»–\u2007\u202F\u00A0]/g,
    (char) => specials[char as keyof typeof specials] || "",
  );
}

const CHAR_EQUIVALENCE_SETS = [
  new Set(["’", "‘", "'", "ʼ", "׳", "ʻ", "᾽", "᾽"]),
  new Set([`"`, "”", "“", "„"]),
  new Set(["–", "—", "-", "‐", "‑"]),
  new Set([",", "‚"]),
];

const LANGUAGE_EQUIVALENCE_SETS: Partial<Record<Language, Set<string>>> = {
  russian: new Set(["ё", "е", "e"]),
};

/**
 * Checks if two characters are visually/typographically equivalent for typing purposes.
 * This allows users to type different variants of the same character and still be considered correct.
 * @param char1 The first character to compare
 * @param char2 The second character to compare
 * @param language Optional language context to check for language-specific equivalences
 * @returns true if the characters are equivalent, false otherwise
 */
export function areCharactersVisuallyEqual(
  char1: string,
  char2: string,
  language?: Language,
): boolean {
  // If characters are exactly the same, they're equivalent
  if (char1 === char2) {
    return true;
  }

  // Treat any Unicode space as equivalent to the regular U+0020 separator.
  // This lets IME-produced spaces (e.g. U+3000) match stored word separators.
  // The U+0020 guard short-circuits the common non-space case before calling isSpace.
  if ((char1 === " " || char2 === " ") && isSpace(char1) && isSpace(char2)) {
    return true;
  }

  // Check each equivalence map
  for (const map of CHAR_EQUIVALENCE_SETS) {
    if (map.has(char1) && map.has(char2)) {
      return true;
    }
  }

  if (language !== undefined) {
    const langMap = LANGUAGE_EQUIVALENCE_SETS[removeLanguageSize(language)];
    if (langMap !== undefined) {
      if (langMap.has(char1) && langMap.has(char2)) {
        return true;
      }
    }
  }

  return false;
}

// hoisted to module scope so isSpace doesn't allocate a Set on every call
// (it runs per keystroke via areCharactersVisuallyEqual)
const SPACE_CODE_POINTS = new Set([
  0x0020, // Regular space (spacebar)
  0x2002, // En space (Option+Space on Mac)
  0x2003, // Em space (Option+Shift+Space on Mac)
  0x2009, // Thin space (various input methods)
  0x3000, // Ideographic space (CJK input methods)
  0x00a0, // Non-breaking space (Alt+0160 on Windows, Option+Space on Mac)
  0x1680, // Ogham space mark (rare, but included for completeness)
  0x202f, // Narrow no-break space (various input methods)
  0xfeff, // Zero width no-break space (various input methods)
  0x2007, // Figure space (various input methods)
  0x2008, // Punctuation space (various input methods)
  0x2004, // Three-per-em space (various input methods)
  0x200a, // Hair space (various input methods)
  0x200b, // Zero width space (various input methods)
]);

/**
 * Checks if a character is a directly typable space character on a standard keyboard.
 * These are space characters that can be typed without special input methods or copy-pasting.
 * @param char The character to check.
 * @returns True if the character is a directly typable space, false otherwise.
 */
export function isSpace(char: string): boolean {
  if (char.length !== 1) return false;

  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) return false;

  return SPACE_CODE_POINTS.has(codePoint);
}

export type CharCounts = {
  allCorrect: number;
  correctWord: number;
  incorrect: number;
  extra: number;
  missed: number;
};

export function countChars(
  inputWord: string,
  targetWord: string,
  creditPartial: boolean,
): CharCounts {
  let allCorrect = 0;
  let correctWord = 0;
  let incorrect = 0;
  let extra = 0;
  let missed = 0;

  const wordCorrect = inputWord === targetWord;
  const wordPartiallyCorrect = targetWord.startsWith(inputWord);

  for (let i = 0; i < Math.max(inputWord.length, targetWord.length); i++) {
    const inputChar = inputWord[i];
    const targetChar = targetWord[i];

    if (inputChar === targetChar) {
      if (targetChar === " " && !wordCorrect) {
        extra += 1;
      } else {
        allCorrect += 1;
      }
      if (wordCorrect || (creditPartial && wordPartiallyCorrect)) {
        correctWord += 1;
      }
    } else if (inputChar === undefined) {
      //missed char
      if (!creditPartial) {
        missed += 1;
      }
    } else if (
      targetChar === undefined ||
      (targetChar === " " && inputChar !== " " && !inputWord.includes(" "))
    ) {
      //extra char (past target, or typed in place of word-ending space)
      extra += 1;
    } else {
      //incorrect char
      incorrect += 1;
    }
  }

  return {
    allCorrect,
    correctWord,
    incorrect,
    extra,
    missed,
  };
}

/**
 * Split a string into characters. This supports multi-byte characters outside of the [Basic Multilinugal Plane](https://en.wikipedia.org/wiki/Plane_(Unicode).
 * Using  `string.length` and `string[index]` does not work.
 * @param s string to be tokenized into characters
 * @returns array of characters
 */
export function splitIntoCharacters(s: string): string[] {
  const result: string[] = [];
  for (const t of s) {
    result.push(t);
  }

  return result;
}
