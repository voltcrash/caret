import type {
  WordsGeneratorConfig,
  WordsGeneratorDeps,
  WordsGenerator,
  GenerateWordsReturn,
  GetNextWordReturn,
} from "./words-generator/types";
import { LanguageObject } from "@oxytype/schemas/languages";
import {
  findSingleFunboxWithFunction,
  getFunboxesWithFunction,
  hasFunboxWithProperty,
} from "./active-funboxes";
import * as Arrays from "./arrays";
import { WordGenError } from "./errors";
import * as GetText from "./generate";
import { FunboxWordOrder } from "./languages";
import * as Numerals from "./numerals";
import { Quote, QuoteWithTextSplit } from "./quotes";
import * as Strings from "./strings";
import {
  FunboxWordsFrequency,
  PolyglotWordset,
  Wordset,
  withWords,
} from "./wordset";

//pin implementation
const random = Math.random;

function shouldCapitalize(lastChar: string): boolean {
  return /[?!.؟]/.test(lastChar);
}

export function createWordsGenerator(deps: WordsGeneratorDeps): WordsGenerator {
  const config = (): WordsGeneratorConfig => deps.getConfig();

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

  function getFunboxWordsFrequency(): FunboxWordsFrequency | undefined {
    const funbox = findSingleFunboxWithFunction(
      deps.getActiveFunboxes(),
      "getWordsFrequencyMode",
    );
    if (funbox) {
      return funbox.functions.getWordsFrequencyMode();
    }
    return undefined;
  }

  async function getFunboxSection(): Promise<string[]> {
    const ret = [];

    const funbox = findSingleFunboxWithFunction(
      deps.getActiveFunboxes(),
      "pullSection",
    );

    if (funbox) {
      const section = await funbox.functions.pullSection(config().language);

      if (section === false || section === undefined) {
        deps.disableFunbox(funbox.name);
        throw new Error("Failed to pull section");
      }

      for (const word of section.words) {
        if (ret.length >= config().words && config().mode === "words") {
          break;
        }
        ret.push(word);
      }
    }
    return ret;
  }

  function getFunboxWord(
    word: string,
    wordIndex: number,
    wordset?: Wordset,
  ): string {
    const funbox = findSingleFunboxWithFunction(
      deps.getActiveFunboxes(),
      "getWord",
    );

    if (funbox) {
      word = funbox.functions.getWord(wordset, wordIndex);
    }
    return word;
  }

  function applyFunboxesToWord(
    word: string,
    wordIndex: number,
    wordsBound: number,
  ): string {
    for (const fb of getFunboxesWithFunction(
      deps.getActiveFunboxes(),
      "alterText",
    )) {
      word = fb.functions.alterText(word, wordIndex, wordsBound);
    }
    return word;
  }

  async function applyBritishEnglishToWord(
    word: string,
    previousWord: string | undefined,
  ): Promise<string> {
    if (!config().britishEnglish) return word;
    if (!config().language.includes("english")) return word;
    const currentQuote = deps.getCurrentQuote();
    if (
      config().mode === "quote" &&
      currentQuote?.britishText !== undefined &&
      currentQuote?.britishText !== ""
    ) {
      return word;
    }

    return await deps.transforms.britishEnglish(word, previousWord);
  }

  function applyLazyModeToWord(word: string, language: LanguageObject): string {
    // polyglot mode, use the word's actual language
    if (currentWordset && currentWordset instanceof PolyglotWordset) {
      const langName = currentWordset.wordsWithLanguage.get(word);
      const langProps = langName
        ? currentWordset.languageProperties.get(langName)
        : undefined;
      const allowLazyMode =
        (langProps && !langProps.noLazyMode) === true ||
        config().mode === "custom";
      if (config().lazyMode && allowLazyMode && langProps) {
        word = deps.transforms.replaceAccents(
          word,
          langProps.additionalAccents,
        );
      }
      return word;
    }

    // normal mode
    const allowLazyMode = !language.noLazyMode || config().mode === "custom";
    if (config().lazyMode && allowLazyMode) {
      word = deps.transforms.replaceAccents(word, language.additionalAccents);
    }
    return word;
  }

  function getWordOrder(): FunboxWordOrder {
    const wordOrderProperty = deps
      .getActiveFunboxes()
      .flatMap((fb) => fb.properties ?? [])
      .find((prop) => prop.startsWith("wordOrder:"));

    return (wordOrderProperty?.split(":")[1] as FunboxWordOrder) ?? "normal";
  }

  function getLimit(): number {
    if (config().mode === "zen") {
      return 0;
    }

    let limit = 100;

    const currentQuote = deps.getCurrentQuote();

    if (config().mode === "quote" && currentQuote === null) {
      throw new WordGenError("Random quote is null");
    }

    const funboxToPush =
      deps
        .getActiveFunboxes()
        .flatMap((fb) => fb.properties ?? [])
        .find((prop) => prop.startsWith("toPush:")) ?? "";

    if (config().showAllLines) {
      if (config().mode === "custom") {
        limit = deps.customText.getLimitValue();
      }
      if (config().mode === "words") {
        limit = config().words;
      }
      if (config().mode === "quote") {
        limit = (currentQuote as QuoteWithTextSplit).textSplit.length;
      }
    }

    //infinite words
    if (config().mode === "words" && config().words === 0) {
      limit = 100;
    }

    //custom
    if (config().mode === "custom") {
      if (
        deps.customText.getLimitValue() === 0 ||
        deps.customText.getLimitMode() === "time"
      ) {
        limit = 100;
      } else {
        limit =
          deps.customText.getLimitValue() > 100
            ? 100
            : deps.customText.getLimitValue();
      }
    }

    //funboxes
    if (funboxToPush) {
      limit = +(funboxToPush.split(":")[1] as string);
    }

    //make sure the limit is not higher than the word count
    if (
      config().mode === "words" &&
      config().words !== 0 &&
      config().words < limit
    ) {
      limit = config().words;
    }

    if (
      config().mode === "quote" &&
      (currentQuote as QuoteWithTextSplit).textSplit.length < limit
    ) {
      limit = (currentQuote as QuoteWithTextSplit).textSplit.length;
    }

    if (
      config().mode === "custom" &&
      deps.customText.getLimitMode() === "word" &&
      deps.customText.getLimitValue() < limit &&
      deps.customText.getLimitValue() !== 0
    ) {
      limit = deps.customText.getLimitValue();
    }

    return limit;
  }

  async function getQuoteWordList(
    language: LanguageObject,
    wordOrder?: FunboxWordOrder,
  ): Promise<string[]> {
    if (deps.isRepeated()) {
      if (currentWordset === null) {
        throw new WordGenError("Current wordset is null");
      }

      deps.setCurrentQuote(previousRandomQuote);

      // need to re-reverse the words if the test is repeated
      // because it will be reversed again in the generateWords function
      if (wordOrder === "reverse") {
        return currentWordset.words.reverse();
      } else {
        return currentWordset.words;
      }
    }
    const languageToGet = language.name.startsWith("swiss_german")
      ? "german"
      : language.name;

    deps.showLoader?.();
    const quotesCollection = await deps.quotes.getQuotes(
      languageToGet,
      config().quoteLength,
    );
    deps.hideLoader?.();

    if (quotesCollection.length === 0) {
      deps.setMode("words");
      throw new WordGenError(
        `No ${config()
          .language.replace(/_\d*k$/g, "")
          .replace(/_/g, " ")} quotes found`,
      );
    }

    let rq: Quote;
    if (
      config().quoteLength.includes(-2) &&
      config().quoteLength.length === 1
    ) {
      const targetQuote = deps.quotes.getQuoteById(deps.getSelectedQuoteId());
      if (targetQuote === undefined) {
        deps.setQuoteLengthAll();
        throw new WordGenError(
          `Quote ${deps.getSelectedQuoteId()} does not exist`,
        );
      }
      rq = targetQuote;
    } else if (config().quoteLength.includes(-3)) {
      const randomQuote = deps.quotes.getRandomFavoriteQuote(config().language);
      if (randomQuote === null) {
        deps.setQuoteLengthAll();
        throw new WordGenError("No favorite quotes found");
      }
      rq = randomQuote;
    } else {
      const randomQuote = deps.quotes.getRandomQuote();
      if (randomQuote === null) {
        deps.setQuoteLengthAll();
        throw new WordGenError("No quotes found for selected quote length");
      }
      rq = randomQuote;
    }

    rq.language = Strings.removeLanguageSize(config().language);
    rq.text = rq.text.replace(/ +/gm, " ");
    rq.text = rq.text.replace(/( *(\r\n|\r|\n) *)/g, "\n ");
    rq.text = rq.text.replace(/…/g, "...");
    rq.text = rq.text.trim();

    if (
      rq.britishText !== undefined &&
      rq.britishText !== "" &&
      config().britishEnglish
    ) {
      rq.textSplit = rq.britishText.split(" ");
    } else {
      rq.textSplit = rq.text.split(" ");
    }

    deps.setCurrentQuote(rq as QuoteWithTextSplit);

    const currentQuote = deps.getCurrentQuote();
    if (currentQuote === null) {
      throw new WordGenError("Random quote is null");
    }

    if (currentQuote.textSplit === undefined) {
      throw new WordGenError("Random quote textSplit is undefined");
    }

    return currentQuote.textSplit;
  }

  let currentWordset: Wordset | null = null;
  let currentLanguage: LanguageObject | null = null;
  let isCurrentlyUsingFunboxSection = false;

  let previousRandomQuote: QuoteWithTextSplit | null = null;

  async function generateWords(
    language: LanguageObject,
  ): Promise<GenerateWordsReturn> {
    if (!deps.isRepeated()) {
      previousGetNextWordReturns = [];
    }
    previousRandomQuote = deps.getCurrentQuote();
    deps.setCurrentQuote(null);
    currentSection = [];
    sectionIndex = 0;
    sectionHistory = [];
    currentLanguage = language;
    const rawWordList: string[] = [];
    const ret: GenerateWordsReturn = {
      words: [],
      sectionIndexes: [],
      hasTab: false,
      hasNewline: false,
      allRightToLeft: language.rightToLeft,
      allJoiningScript: language.joiningScript ?? false,
    };

    isCurrentlyUsingFunboxSection =
      getFunboxesWithFunction(deps.getActiveFunboxes(), "pullSection").length >
      0;

    const wordOrder = getWordOrder();

    let wordList = language.words;
    if (config().mode === "custom") {
      wordList = deps.customText.getText();
    } else if (config().mode === "quote") {
      wordList = await getQuoteWordList(language, wordOrder);
    } else if (config().mode === "zen") {
      wordList = [];
    }

    const customAndUsingPipeDelimiter =
      config().mode === "custom" && deps.customText.getPipeDelimiter();

    const limit = getLimit();

    if (wordOrder === "reverse") {
      wordList = wordList.reverse();
    }

    const funbox = findSingleFunboxWithFunction(
      deps.getActiveFunboxes(),
      "withWords",
    );
    if (funbox) {
      const result = await funbox.functions.withWords(wordList);
      // PolyglotWordset if polyglot otherwise Wordset
      if (result instanceof PolyglotWordset) {
        const polyglotResult = result;
        currentWordset = polyglotResult;
        // set allJoiningScript if any language in languageProperties has joiningScript: true
        ret.allJoiningScript = Array.from(
          polyglotResult.languageProperties.values(),
        ).some((props) => !!props.joiningScript);
      } else {
        currentWordset = result;
      }
    } else {
      currentWordset = await withWords(wordList);
    }

    if (limit === 0) {
      return ret;
    }

    let stop = false;
    let i = 0;
    while (!stop) {
      const nextWord = await getNextWord(
        i,
        limit,
        Arrays.nthElementFromArray(rawWordList, -1) ?? "",
        Arrays.nthElementFromArray(rawWordList, -2) ?? "",
      );
      rawWordList.push(nextWord.wordRaw);
      ret.words.push(nextWord.word);
      ret.sectionIndexes.push(nextWord.sectionIndex);

      if (customAndUsingPipeDelimiter) {
        //generate a given number of sections, make sure to not cut a section off
        const sectionFinishedAndOverLimit =
          currentSection.length === 0 && sectionIndex >= limit;
        //make sure we dont go over a hard limit, in cases where the sections are very large
        const upperWordLimit = ret.words.length >= 100;
        if (sectionFinishedAndOverLimit || upperWordLimit) {
          stop = true;
        }
      } else if (ret.words.length >= limit) {
        stop = true;
      }
      i++;
    }

    const quote = deps.getCurrentQuote();

    if (config().mode === "quote" && quote === null) {
      throw new WordGenError("Random quote is null");
    }

    ret.hasTab =
      ret.words.some((w) => w.includes("\t")) ||
      currentWordset.words.some((w) => w.includes("\t")) ||
      (config().mode === "quote" &&
        (quote as QuoteWithTextSplit).textSplit.some((w) => w.includes("\t")));
    ret.hasNewline =
      ret.words.some((w) => w.includes("\n")) ||
      currentWordset.words.some((w) => w.includes("\n")) ||
      (config().mode === "quote" &&
        (quote as QuoteWithTextSplit).textSplit.some((w) => w.includes("\n")));

    sectionHistory = []; //free up a bit of memory? is that even a thing?
    return ret;
  }

  let sectionIndex = 0;
  let currentSection: string[] = [];
  let sectionHistory: string[] = [];

  let previousGetNextWordReturns: GetNextWordReturn[] = [];

  //generate next word
  async function getNextWord(
    wordIndex: number,
    wordsBound: number,
    previousWord: string | undefined,
    previousWord2: string | undefined,
  ): Promise<GetNextWordReturn> {
    if (currentWordset === null) {
      throw new WordGenError("Current wordset is null");
    }

    if (currentLanguage === null) {
      throw new WordGenError("Current language is null");
    }

    //because quote test can be repeated in the middle of a test
    //we cant rely on data inside previousGetNextWordReturns
    //because it might not include the full quote
    if (deps.isRepeated() && config().mode !== "quote") {
      const repeated = previousGetNextWordReturns[wordIndex];

      if (repeated === undefined) {
        // if the repeated word is undefined, that means we are out of words from the previous test
        // we need to either throw, or revert to random generation
        // reverting should only happen in certain cases

        let continueRandomGeneration = false;

        if (
          config().mode === "time" ||
          (config().mode === "custom" &&
            deps.customText.getLimitMode() === "time") ||
          (config().mode === "custom" &&
            deps.customText.getLimitMode() === "word" &&
            wordIndex < deps.customText.getLimitValue()) ||
          (config().mode === "custom" &&
            deps.customText.getLimitMode() === "section" &&
            sectionIndex < deps.customText.getLimitValue()) ||
          (config().mode === "words" && wordIndex < config().words)
        ) {
          continueRandomGeneration = true;
        }

        if (!continueRandomGeneration) {
          throw new WordGenError("Repeated word is undefined");
        }
      } else {
        sectionIndex++;
        return repeated;
      }
    }

    const funboxFrequency = getFunboxWordsFrequency() ?? "normal";
    let randomWord = currentWordset.randomWord(funboxFrequency);
    const previousWordRaw = previousWord
      ?.replace(/[.?!":\-,]/g, "")
      .toLowerCase();
    const previousWord2Raw = previousWord2
      ?.replace(/[.?!":\-,']/g, "")
      .toLowerCase();

    if (currentSection.length === 0) {
      const funboxSection = await getFunboxSection();

      if (config().mode === "quote") {
        randomWord = currentWordset.nextWord();
      } else if (
        config().mode === "custom" &&
        deps.customText.getMode() === "repeat"
      ) {
        randomWord = currentWordset.nextWord();
      } else if (
        config().mode === "custom" &&
        deps.customText.getMode() === "random" &&
        (currentWordset.length < 4 || deps.isPractiseWordsActive())
      ) {
        randomWord = currentWordset.randomWord(funboxFrequency);
      } else if (
        config().mode === "custom" &&
        deps.customText.getMode() === "shuffle"
      ) {
        randomWord = currentWordset.shuffledWord();
      } else if (
        config().mode === "custom" &&
        deps.customText.getLimitMode() === "section"
      ) {
        randomWord = currentWordset.randomWord(funboxFrequency);

        const previousSection = Arrays.nthElementFromArray(sectionHistory, -1);
        const previousSection2 = Arrays.nthElementFromArray(sectionHistory, -2);

        let regenerationCount = 0;
        while (
          regenerationCount < 100 &&
          (previousSection === randomWord || previousSection2 === randomWord)
        ) {
          regenerationCount++;
          randomWord = currentWordset.randomWord(funboxFrequency);
        }
      } else if (isCurrentlyUsingFunboxSection) {
        randomWord = funboxSection.join(" ");
      } else {
        let regenarationCount = 0; //infinite loop emergency stop button
        let firstAfterSplit = (
          randomWord.split(" ")[0] as string
        ).toLowerCase();
        let firstAfterSplitLazy = applyLazyModeToWord(
          firstAfterSplit,
          currentLanguage,
        );
        while (
          regenarationCount < 100 &&
          (previousWordRaw === firstAfterSplitLazy ||
            previousWord2Raw === firstAfterSplitLazy ||
            (config().mode !== "custom" &&
              !config().punctuation &&
              randomWord === "I") ||
            (config().mode !== "custom" &&
              !config().punctuation &&
              !config().language.startsWith("code") &&
              /[-=_+[\]{};'\\:"|,./<>?]/i.test(randomWord)) ||
            (config().mode !== "custom" &&
              !config().numbers &&
              /[0-9]/i.test(randomWord)))
        ) {
          regenarationCount++;
          randomWord = currentWordset.randomWord(funboxFrequency);
          firstAfterSplit = randomWord.split(" ")[0] as string;
          firstAfterSplitLazy = applyLazyModeToWord(
            firstAfterSplit,
            currentLanguage,
          );
        }
      }
      randomWord = randomWord.replace(/ +/g, " ");
      randomWord = randomWord.replace(/(^ )|( $)/g, "");

      randomWord = getFunboxWord(randomWord, wordIndex, currentWordset);

      currentSection = [...randomWord.split(" ")];
      sectionHistory.push(randomWord);
      randomWord = currentSection.shift() as string;
      sectionIndex++;
    } else {
      randomWord = currentSection.shift() as string;
    }

    if (randomWord === undefined) {
      throw new WordGenError("Random word is undefined");
    }

    if (randomWord === "") {
      throw new WordGenError("Random word is empty");
    }

    if (/ /g.test(randomWord)) {
      throw new WordGenError("Random word contains spaces");
    }

    const usingFunboxWithGetWord =
      getFunboxesWithFunction(deps.getActiveFunboxes(), "getWord").length > 0;
    const randomWordLanguage =
      (currentWordset instanceof PolyglotWordset
        ? currentWordset.wordsWithLanguage.get(randomWord)
        : config().language) ?? config().language; // Fall back to Config language if per-word language is unavailable

    if (
      config().mode !== "custom" &&
      config().mode !== "quote" &&
      /[A-Z]/.test(randomWord) &&
      !config().punctuation &&
      !randomWordLanguage.startsWith("german") &&
      !randomWordLanguage.startsWith("swiss_german") &&
      !randomWordLanguage.startsWith("code") &&
      !randomWordLanguage.startsWith("klingon") &&
      !isCurrentlyUsingFunboxSection &&
      !usingFunboxWithGetWord
    ) {
      randomWord = randomWord.toLowerCase();
    }

    randomWord = randomWord.replace(/ +/gm, " ");
    randomWord = randomWord.replace(/(^ )|( $)/gm, "");
    randomWord = applyLazyModeToWord(randomWord, currentLanguage);

    if (config().language.startsWith("swiss_german")) {
      randomWord = randomWord.replace(/ß/g, "ss");
    }

    if (
      config().punctuation &&
      !currentLanguage.originalPunctuation &&
      !isCurrentlyUsingFunboxSection
    ) {
      randomWord = await punctuateWord(
        previousWord,
        randomWord,
        wordIndex,
        wordsBound,
      );
    }

    randomWord = await applyBritishEnglishToWord(randomWord, previousWordRaw);

    if (config().numbers) {
      if (random() < 0.1) {
        randomWord = GetText.getNumbers(4);

        if (config().language.startsWith("kurdish")) {
          randomWord = Numerals.convertNumberToArabic(randomWord);
        } else if (config().language.startsWith("nepali")) {
          randomWord = Numerals.convertNumberToNepali(randomWord);
        } else if (config().language.startsWith("bangla")) {
          randomWord = Numerals.convertNumberToBangla(randomWord);
        } else if (config().language.startsWith("hindi")) {
          randomWord = Numerals.convertNumberToHindi(randomWord);
        }
      }
    }

    randomWord = applyFunboxesToWord(randomWord, wordIndex, wordsBound);

    const ret = {
      word: appendCommitCharacter(randomWord),
      wordRaw: randomWord,
      sectionIndex: sectionIndex,
    };

    previousGetNextWordReturns.push(ret);

    return ret;
  }

  /**
   * Appends the inter-word commit separator the way the generator does: a trailing
   * space, unless the word already ends with a newline or the nospace funbox is
   * active. Callers that push words outside of getNextWord (e.g. section funbox
   * pulls) must use this so the separator is part of the target word.
   */
  function appendCommitCharacter(word: string): string {
    if (
      word.endsWith("\n") ||
      hasFunboxWithProperty(deps.getActiveFunboxes(), "nospace")
    ) {
      return word;
    }
    return `${word} `;
  }

  function areAllWordsGenerated(): boolean {
    return (
      (config().mode === "words" &&
        deps.getWordsLength() >= config().words &&
        config().words > 0) ||
      (config().mode === "custom" &&
        deps.customText.getLimitMode() === "word" &&
        deps.getWordsLength() >= deps.customText.getLimitValue() &&
        deps.customText.getLimitValue() !== 0) ||
      (config().mode === "quote" &&
        deps.getWordsLength() >=
          (deps.getCurrentQuote()?.textSplit?.length ?? 0)) ||
      (config().mode === "custom" &&
        deps.customText.getLimitMode() === "section" &&
        sectionIndex >= deps.customText.getLimitValue() &&
        currentSection.length === 0 &&
        deps.customText.getLimitValue() !== 0)
    );
  }

  return {
    generateWords,
    getNextWord,
    appendCommitCharacter,
    areAllWordsGenerated,
  };
}

export type {
  WordsGeneratorConfig,
  CustomTextSource,
  QuoteSource,
  WordTransforms,
  WordsGeneratorDeps,
  WordsGenerator,
  GenerateWordsReturn,
  GetNextWordReturn,
} from "./words-generator/types";
