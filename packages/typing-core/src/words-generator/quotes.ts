import type { LanguageObject } from "@oxytype/schemas/languages";
import { WordGenError } from "../errors";
import type { FunboxWordOrder } from "../languages";
import type { Quote, QuoteWithTextSplit } from "../quotes";
import * as Strings from "../strings";
import type { Wordset } from "../wordset";
import type { WordsGeneratorConfig, WordsGeneratorDeps } from "./types";

export async function getQuoteWordList(
  deps: WordsGeneratorDeps,
  language: LanguageObject,
  currentWordset: Wordset | null,
  previousRandomQuote: QuoteWithTextSplit | null,
  wordOrder?: FunboxWordOrder,
): Promise<string[]> {
  const config = (): WordsGeneratorConfig => deps.getConfig();
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
  if (config().quoteLength.includes(-2) && config().quoteLength.length === 1) {
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
