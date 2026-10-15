import { getMutableConfig } from "../../config/store";
import QuotesController, { Quote } from "../../controllers/quotes-controller";
import * as DB from "../../db";
import { isAuthenticated } from "../../states/core";
import { getQuoteStats } from "../../states/quote-rate";
import * as Numbers from "@oxytype/util/numbers";
import { setResultState } from "../../states/result";

export function updateQuoteRating(rating: string): void {
  setResultState("quote", { rated: true, rating });
}

export function updateRateQuote(randomQuote: Quote | null): void {
  if (getMutableConfig().mode === "quote") {
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
  if (getMutableConfig().mode !== "quote" || !isAuthenticated()) {
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
