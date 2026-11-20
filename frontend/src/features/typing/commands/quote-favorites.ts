import { peekConfig } from "#shared/config/store.ts";
import QuotesController, { Quote } from "../runtime/quotes-controller";
import {
  showErrorNotification,
  showSuccessNotification,
} from "#shared/states/notifications.ts";
import { isAuthenticated } from "#shared/states/core.ts";
import { showLoaderBar, hideLoaderBar } from "#shared/states/loader-bar.ts";
import { Command } from "#shared/commandline/types.ts";
import { getCurrentQuote } from "#shared/states/test.ts";

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
        peekConfig().mode === "quote" &&
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
        peekConfig().mode === "quote" &&
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
