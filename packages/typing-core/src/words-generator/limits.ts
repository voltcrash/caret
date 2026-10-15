import { WordGenError } from "../errors";
import type { QuoteWithTextSplit } from "../quotes";
import type { WordsGeneratorConfig, WordsGeneratorDeps } from "./types";

export function getGenerationLimit(deps: WordsGeneratorDeps): number {
  const config = (): WordsGeneratorConfig => deps.getConfig();
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
