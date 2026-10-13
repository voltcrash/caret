import type { Language, LanguageObject } from "@oxytype/schemas/languages";
import type { FetchJson } from "@oxytype/typing-core/languages";
import { createLanguageLoader } from "@oxytype/typing-core/languages";
import {
  LayoutObjectSchema,
  type LayoutName,
  type LayoutObject,
} from "@oxytype/schemas/layouts";
import { getPoem } from "@oxytype/typing-core/poetry";
import { getSection } from "@oxytype/typing-core/wikipedia";
import { QuotesController } from "@oxytype/typing-core/quote-source";
import { tryCatch } from "@oxytype/util/trycatch";

import { AssetUnavailableError } from "../assets/source";

/** Always bundled, so a test can start without downloads. */
const fallbackLanguage: Language = "english";

type LoadedLanguage = {
  language: LanguageObject;
  /** Set when the configured language was unavailable offline. */
  missing?: Language;
  missingQuotes?: boolean;
};

export type TestSources = {
  loadLanguage: (
    language: Language,
    quoteLengths?: number[],
  ) => Promise<LoadedLanguage>;
  quotes: QuotesController;
  getLayout: (name: LayoutName) => Promise<LayoutObject>;
  getPoem: () => ReturnType<typeof getPoem>;
  getSection: (language: Language) => ReturnType<typeof getSection>;
  getScript: (name: string) => Promise<string>;
};

export function createTestSources(
  fetchJson: FetchJson,
  getSnapshot: ConstructorParameters<
    typeof QuotesController
  >[0]["getSnapshot"] = () => null,
): TestSources {
  let languages = createLanguageLoader({ fetchJson });
  const quotes = new QuotesController({ fetchJson, getSnapshot });
  const externalJson: FetchJson = async (url) => {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      credentials: "omit",
      redirect: "error",
    });
    if (!response.ok) {
      throw new Error(`Text source unavailable (${response.status})`);
    }
    return response.json() as Promise<unknown>;
  };
  return {
    loadLanguage: async (language, quoteLengths) => {
      const loaded = await tryCatch(languages.getLanguage(language));
      if (loaded.error === null) {
        if (quoteLengths === undefined) return { language: loaded.data };
        const quoteLanguage = language.startsWith("swiss_german")
          ? "german"
          : language;
        const collection = await quotes.getQuotes(quoteLanguage, quoteLengths);
        if (collection.length > 0) {
          quotes.updateQuoteQueue(quoteLengths);
          return { language: loaded.data };
        }
      } else if (!(loaded.error instanceof AssetUnavailableError)) {
        throw loaded.error;
      }
      // Core memoizes failures; a new loader allows a later reconnect to retry.
      languages = createLanguageLoader({ fetchJson });
      if (quoteLengths !== undefined) {
        await quotes.getQuotes(fallbackLanguage, quoteLengths);
        quotes.updateQuoteQueue(quoteLengths);
      }
      return {
        language: await languages.getLanguage(fallbackLanguage),
        missing: language,
        missingQuotes: loaded.error === null && quoteLengths !== undefined,
      };
    },
    quotes,
    getLayout: async (name) =>
      LayoutObjectSchema.parse(await fetchJson(`layouts/${name}.json`)),
    getPoem: async () => getPoem(externalJson),
    getSection: async (language) =>
      getSection(language, {
        fetchJson: async (url) =>
          externalJson(
            url.includes("/w/api.php") ? `${url}&explaintext=1` : url,
          ),
        getLanguage: languages.getLanguage,
        htmlToText: (text) => text,
      }),
    getScript: async (name) => {
      const data = await fetchJson(`challenges/${name}`);
      if (typeof data !== "string" || data.trim() === "") {
        throw new Error("Invalid challenge script");
      }
      return data;
    },
  };
}
