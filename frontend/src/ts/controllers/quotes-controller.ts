import { createAppOwned } from "../../app/application";
import { appObject } from "../../app/state";
import { QuotesController as CoreQuotesController } from "@oxytype/typing-core/quote-source";
import { Quote } from "@oxytype/typing-core/quotes";
export type { Quote } from "@oxytype/typing-core/quotes";
import { removeLanguageSize } from "../utils/strings";
import { cachedFetchJson } from "../utils/json-data";
import { configEvent } from "../events/config";
import * as DB from "../db";
import Ape from "../ape";
import { Language } from "@oxytype/schemas/languages";

class QuotesController extends CoreQuotesController {
  constructor() {
    super({ fetchJson: cachedFetchJson, getSnapshot: DB.getSnapshot });
  }
  isQuoteFavorite({ language: quoteLanguage, id }: Quote): boolean {
    const snapshot = DB.getSnapshot();
    if (!snapshot) {
      return false;
    }

    const { favoriteQuotes } = snapshot;

    if (favoriteQuotes === undefined) {
      return false;
    }

    const normalizedQuoteLanguage = removeLanguageSize(quoteLanguage);

    const matchedLanguage = (Object.keys(favoriteQuotes) as Language[]).find(
      (language) => {
        if (normalizedQuoteLanguage !== removeLanguageSize(language)) {
          return false;
        }
        return (favoriteQuotes[language] ?? []).includes(id.toString());
      },
    );

    return matchedLanguage !== undefined;
  }

  async setQuoteFavorite(quote: Quote, isFavorite: boolean): Promise<void> {
    const snapshot = DB.getSnapshot();
    if (!snapshot) {
      throw new Error("Snapshot is not available");
    }

    if (!isFavorite) {
      // Remove from favorites
      const response = await Ape.users.removeQuoteFromFavorites({
        body: {
          language: quote.language,
          quoteId: `${quote.id}`,
        },
      });

      if (response.status === 200) {
        const quoteIndex = snapshot.favoriteQuotes?.[quote.language]?.indexOf(
          `${quote.id}`,
        ) as number;
        snapshot.favoriteQuotes?.[quote.language]?.splice(quoteIndex, 1);
      } else {
        throw new Error(response.body.message);
      }
    } else {
      // Remove from favorites
      const response = await Ape.users.addQuoteToFavorites({
        body: {
          language: quote.language,
          quoteId: `${quote.id}`,
        },
      });

      if (response.status === 200) {
        snapshot.favoriteQuotes ??= {};
        snapshot.favoriteQuotes[quote.language] ??= [];
        snapshot.favoriteQuotes[quote.language]?.push(`${quote.id}`);
      } else {
        throw new Error(response.body.message);
      }
    }
  }
}

const quoteController = appObject(createAppOwned(() => new QuotesController()));

export default quoteController;

export function useQuoteEvents(): void {
  configEvent.useListener(({ key, newValue }) => {
    if (key === "quoteLength") {
      quoteController.updateQuoteQueue(newValue);
    }
  });
}
