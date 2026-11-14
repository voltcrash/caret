import { JSXElement } from "solid-js";

import { operation } from "../../../../data/operations";
import { Balloon } from "../../../../ts/components/common/Balloon";
import { Fa } from "../../../../ts/components/common/Fa";
import * as DB from "../../../../ts/db";
import { hideLoaderBar, showLoaderBar } from "../../../../ts/states/loader-bar";
import {
  addNotificationWithLevel,
  showErrorNotification,
} from "../../../../ts/states/notifications";
import { showQuoteRateModal } from "../../../../ts/states/quote-rate";
import { showQuoteReportModal } from "../../../../ts/states/quote-report";
import { resultState, setResultState } from "../../../../ts/states/result";
import { getCurrentQuote } from "../../../../ts/states/test";
import { cn } from "../../../../ts/utils/cn";

async function toggleFavorite(): Promise<void> {
  const { language: quoteLang, id: quoteId, favorite } = resultState.quote;
  if (quoteLang === undefined || quoteId === "") {
    showErrorNotification("Could not get quote stats!");
    return;
  }

  const dbSnapshot = DB.getSnapshot();
  if (!dbSnapshot) return;

  if (favorite) {
    // Remove from
    showLoaderBar();
    const response = await operation("users.removeQuoteFromFavorites", {
      body: {
        language: quoteLang,
        quoteId,
      },
    });
    hideLoaderBar();

    addNotificationWithLevel(
      response.message,
      response.ok ? "success" : "error",
    );

    if (response.ok) {
      setResultState("quote", "favorite", false);
      DB.updateLocalQuoteFavorite(quoteLang, quoteId, false);
    }
  } else {
    // Add to favorites
    showLoaderBar();
    const response = await operation("users.addQuoteToFavorites", {
      body: { language: quoteLang, quoteId },
    });
    hideLoaderBar();

    addNotificationWithLevel(
      response.message,
      response.ok ? "success" : "error",
    );

    if (response.ok) {
      setResultState("quote", "favorite", true);
      DB.updateLocalQuoteFavorite(quoteLang, quoteId, true);
    }
  }
}

export function ResultQuoteActions(): JSXElement {
  const quote = () => resultState.quote;

  return (
    <>
      <Balloon
        as="button"
        type="button"
        id="reportQuoteButton"
        class={cn(
          "textButton px-1 py-0 max-sm:min-h-9 max-sm:min-w-9 max-sm:items-center",
          !quote().reportVisible && "hidden",
        )}
        aria-label="Report quote"
        text="Report quote"
        data-balloon-pos="up"
        onClick={() => {
          const currentQuote = getCurrentQuote();
          if (currentQuote === null) {
            showErrorNotification(
              "Failed to show quote report popup: no quote",
            );
            return;
          }
          showQuoteReportModal(currentQuote.id);
        }}
      >
        <Fa icon="fa-flag" fixedWidth class="icon" />
      </Balloon>
      <Balloon
        as="button"
        type="button"
        id="favoriteQuoteButton"
        class={cn(
          "textButton px-1 py-0 max-sm:min-h-9 max-sm:min-w-9 max-sm:items-center",
          !quote().favoriteVisible && "hidden",
        )}
        aria-label="Favorite quote"
        text="Favorite quote"
        data-balloon-pos="up"
        onClick={() => void toggleFavorite()}
      >
        <Fa
          icon="fa-heart"
          variant={quote().favorite ? "solid" : "regular"}
          fixedWidth
          class="icon"
        />
      </Balloon>
      <Balloon
        as="button"
        type="button"
        id="rateQuoteButton"
        class={cn(
          "textButton gap-1 px-1 py-0 max-sm:min-h-9 max-sm:min-w-9 max-sm:items-center",
          !quote().rateVisible && "hidden",
        )}
        aria-label="Rate quote"
        text="Rate quote"
        data-balloon-pos="up"
        onClick={() => {
          const currentQuote = getCurrentQuote();
          if (currentQuote === null) {
            showErrorNotification(
              "Failed to show quote rating popup: no quote",
            );
            return;
          }
          showQuoteRateModal(currentQuote);
        }}
      >
        <Fa
          icon="fa-star"
          variant={quote().rated ? "solid" : "regular"}
          fixedWidth
          class="icon"
        />
        <span class="rating">{quote().rating}</span>
      </Balloon>
    </>
  );
}
