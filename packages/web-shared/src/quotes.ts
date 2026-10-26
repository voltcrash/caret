import { Language } from "@caret/schemas/languages";
import { QuoteDataQuote } from "@caret/schemas/quotes";

export type Quote = QuoteDataQuote & {
  group: number;
  language: Language;
  textSplit?: string[];
};

export type QuoteWithTextSplit = Omit<Quote, "textSplit"> &
  Required<Pick<Quote, "textSplit">>;
