import type { Language } from "@oxytype/schemas/languages";
import { queryOptions } from "@tanstack/solid-query";
import { operationData } from "../../data/operations";
import { baseKey } from "./utils/keys";

export type QuoteStats = {
  average?: number;
  ratings?: number;
  totalRating?: number;
  quoteId?: number;
  language?: Language;
};

export function getQuoteRatingQueryOptions(
  quoteId: number,
  language: Language,
) {
  return queryOptions({
    queryKey: [
      ...baseKey("quoteRating", { isUserSpecific: true }),
      language,
      quoteId,
    ],
    queryFn: async (): Promise<QuoteStats | null> =>
      await operationData("quotes.getRating", { query: { quoteId, language } }),
    staleTime: 0,
    retry: false,
  });
}

export function getQuoteSubmissionsQueryOptions() {
  return queryOptions({
    queryKey: baseKey("quoteSubmissions", { isUserSpecific: true }),
    queryFn: async () => await operationData("quotes.get"),
    staleTime: 0,
    retry: false,
  });
}

export function getQuoteSubmissionEnabledQueryOptions() {
  return queryOptions({
    queryKey: ["quoteSubmissionEnabled"],
    queryFn: async () => await operationData("quotes.isSubmissionEnabled"),
    staleTime: 0,
    retry: false,
  });
}
