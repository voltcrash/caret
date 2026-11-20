import { peekConfig } from "../../../../ts/config/store";
import QuotesController, { Quote } from "../quotes-controller";
import * as DB from "../../../../ts/db";
import { isAuthenticated } from "../../../../ts/states/core";
import { getQuoteStats } from "../../state/quote-rate";
import * as Numbers from "@caret/util/numbers";
import { setResultState } from "../../state/result";

export function updateQuoteRating(rating: string): void {
  setResultState("quote", { rated: true, rating });
}

export function updateRateQuote(randomQuote: Quote | null): void {
  if (peekConfig().mode === "quote") {
    if (randomQuote === null) {
      console.error(
        "Failed to update quote rating button: randomQuote is null",
      );
      return;
    }

    const userqr =
      DB.getSnapshot()?.quoteRatings?.[randomQuote.language]?.[randomQuote.id];
    if (Numbers.isSafeNumber(userqr)) {
      setResultState("quote", "rated", true);
    }
    getQuoteStats(randomQuote)
      .then((quoteStats) => {
        setResultState(
          "quote",
          "rating",
          quoteStats?.average?.toFixed(1) ?? "",
        );
      })
      .catch((_e: unknown) => {
        setResultState("quote", "rating", "?");
      });
    setResultState("quote", "rateVisible", true);
  }
}

export function updateQuoteFavorite(randomQuote: Quote | null): void {
  if (peekConfig().mode !== "quote" || !isAuthenticated()) {
    setResultState("quote", "favoriteVisible", false);
    return;
  }

  if (randomQuote === null) {
    console.error(
      "Failed to update quote favorite button: randomQuote is null",
    );
    return;
  }

  setResultState("quote", {
    language: randomQuote.language,
    id: randomQuote.id.toString(),
    favorite: QuotesController.isQuoteFavorite(randomQuote),
    favoriteVisible: true,
  });
}
