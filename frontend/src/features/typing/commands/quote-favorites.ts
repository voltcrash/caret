import { getMutableConfig } from "../../../ts/config/store";
import QuotesController, { Quote } from "../runtime/quotes-controller";
import {
  showErrorNotification,
  showSuccessNotification,
} from "../../../ts/states/notifications";
import { isAuthenticated } from "../../../ts/states/core";
import { showLoaderBar, hideLoaderBar } from "../../../ts/states/loader-bar";
import { Command } from "../../../ts/commandline/types";
import { getCurrentQuote } from "../../../ts/states/test";

const commands: Command[] = [
  {
    id: "addQuoteToFavorite",
    display: "Add current quote to favorite",
    icon: "fa-heart",
    available: (): boolean => {
      const quote = getCurrentQuote();
      return (
        isAuthenticated() &&
        quote !== null &&
        getMutableConfig().mode === "quote" &&
        !QuotesController.isQuoteFavorite(quote)
      );
    },
    exec: async (): Promise<void> => {
      try {
        showLoaderBar();
        await QuotesController.setQuoteFavorite(
          getCurrentQuote() as Quote,
          true,
        );
        hideLoaderBar();
        showSuccessNotification("Quote added to favorites");
      } catch (e) {
        hideLoaderBar();
        showErrorNotification("Failed to add quote to favorites", { error: e });
      }
    },
  },
  {
    id: "removeQuoteFromFavorite",
    display: "Remove current quote from favorite",
    icon: "fa-heart-broken",
    available: (): boolean => {
      const quote = getCurrentQuote();
      return (
        isAuthenticated() &&
        quote !== null &&
        getMutableConfig().mode === "quote" &&
        QuotesController.isQuoteFavorite(quote)
      );
    },
    exec: async (): Promise<void> => {
      try {
        showLoaderBar();
        await QuotesController.setQuoteFavorite(
          getCurrentQuote() as Quote,
          false,
        );
        hideLoaderBar();
        showSuccessNotification("Quote removed from favorites");
      } catch (e) {
        hideLoaderBar();
        showErrorNotification("Failed to remove quote from favorites", {
          error: e,
        });
      }
    },
  },
];

export default commands;
