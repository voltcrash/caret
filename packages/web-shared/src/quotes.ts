import { Language } from "@oxytype/schemas/languages";
import { QuoteDataQuote } from "@oxytype/schemas/quotes";

export type Quote = QuoteDataQuote & {
  group: number;
  language: Language;
  textSplit?: string[];
};

export type QuoteWithTextSplit = Omit<Quote, "textSplit"> &
  Required<Pick<Quote, "textSplit">>;
