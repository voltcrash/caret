import { createEffect, createSignal, onCleanup } from "solid-js";
import { QueryObserver } from "@tanstack/solid-query";
import { createAccountOwned } from "../../app/account-scope";
import { getQueryClient } from "../queries";
import { getQuoteRatingQueryOptions, type QuoteStats } from "../queries/quotes";
import { createAppSignal } from "../../app/state";

import { Quote } from "../controllers/quotes-controller";
import { showErrorNotification } from "./notifications";
import { showModal } from "./modals";
import { isSafeNumber } from "@oxytype/util/numbers";

const [selectedQuote, setSelectedQuote] = createAppSignal<Quote | null>(null);
export { selectedQuote };

function ratingOptions():
  | ReturnType<typeof getQuoteRatingQueryOptions>
  | undefined {
  const quote = selectedQuote();
  return quote === null
    ? undefined
    : getQuoteRatingQueryOptions(quote.id, quote.language);
}

function derivedStats(data: QuoteStats | null | undefined): QuoteStats | null {
  if (data === undefined) return null;
  if (data === null) return {};
  return { ...data, average: data.average ?? getRatingAverage(data) };
}

/** A reactive view of Query data, recreated on account changes. */
const observedStats = createAccountOwned(() => {
  const observer = new QueryObserver<
    QuoteStats | null,
    Error,
    QuoteStats | null,
    QuoteStats | null,
    unknown[]
  >(getQueryClient(), {
    queryKey: ["quoteRating", "none"],
    enabled: false,
  });
  const [data, setData] = createSignal<QuoteStats | null>(null);
  const publish = (): void => {
    setData(derivedStats(observer.getCurrentResult().data));
  };
  onCleanup(observer.subscribe(publish));
  onCleanup(() => observer.destroy());
  createEffect(() => {
    observer.setOptions({
      ...(ratingOptions() ?? { queryKey: ["quoteRating", "none"] }),
      enabled: false,
    });
    publish();
  });
  return data;
});

export function quoteStats(): QuoteStats | null {
  return observedStats()();
}

export function clearQuoteStats(): void {
  const options = ratingOptions();
  if (options !== undefined) {
    void getQueryClient().resetQueries({
      queryKey: options.queryKey,
      exact: true,
    });
  }
}

export function getRatingAverage(stats: QuoteStats): number {
  if (
    isSafeNumber(stats.ratings) &&
    isSafeNumber(stats.totalRating) &&
    stats.ratings > 0 &&
    stats.totalRating > 0
  ) {
    return Math.round((stats.totalRating / stats.ratings) * 10) / 10;
  }
  return 0;
}

export async function getQuoteStats(
  quote?: Quote,
): Promise<QuoteStats | undefined> {
  if (!quote) return;

  setSelectedQuote(quote);
  try {
    const data = await getQueryClient().query(
      getQuoteRatingQueryOptions(quote.id, quote.language),
    );
    return derivedStats(data) ?? {};
  } catch (error) {
    showErrorNotification("Failed to get quote ratings", { error });
    return;
  }
}

export function updateQuoteStats(stats: QuoteStats): void {
  const options = ratingOptions();
  if (options !== undefined) {
    getQueryClient().setQueryData(options.queryKey, stats);
  }
}

export function showQuoteRateModal(quote: Quote): void {
  setSelectedQuote(quote);
  showModal("QuoteRate");
}
