import { afterEach, expect, it, vi } from "vite-plus/test";
import type { Quote } from "@oxytype/typing-core/quotes";
import { getQueryClient } from "../../src/ts/queries";
import { getQuoteRatingQueryOptions } from "../../src/ts/queries/quotes";
import {
  getQuoteStats,
  quoteStats,
  updateQuoteStats,
} from "../../src/ts/states/quote-rate";
import { setUserId } from "../../src/ts/states/core";
import { mockOperation, ok, resetOperations } from "../__harness__/operations";

const quote = (id: number): Quote => ({
  id,
  language: "english",
  text: "fixture",
  source: "fixture",
  length: 7,
  group: 0,
});
afterEach(() => {
  setUserId(null);
  resetOperations();
});

it("uses one query for fetched ratings, derived averages and mutation acknowledgements", async () => {
  setUserId("ratings-a");
  mockOperation("quotes.getRating", () => ok({ ratings: 2, totalRating: 8 }));
  await getQuoteStats(quote(1));
  expect(quoteStats()).toMatchObject({ ratings: 2, average: 4 });
  updateQuoteStats({
    quoteId: 1,
    language: "english",
    ratings: 3,
    totalRating: 14,
  });
  expect(
    getQueryClient().getQueryData(
      getQuoteRatingQueryOptions(1, "english").queryKey,
    ),
  ).toMatchObject({ ratings: 3, totalRating: 14 });
  await vi.waitFor(() => expect(quoteStats()?.average).toBe(4.7));
  setUserId("ratings-b");
  expect(quoteStats()).toBeNull();
});

it("does not display a previous quote's late response after selecting another quote", async () => {
  setUserId("ratings-c");
  let finish!: (value: unknown) => void;
  mockOperation("quotes.getRating", async (input) => {
    const id = (input["query"] as { quoteId: number }).quoteId;
    return id === 1
      ? await new Promise((resolve) => {
          finish = resolve;
        })
      : ok({ ratings: 4, totalRating: 20 });
  });
  const first = getQuoteStats(quote(1));
  await vi.waitFor(() => expect(finish).toBeDefined());
  await getQuoteStats(quote(2));
  expect(quoteStats()).toMatchObject({ ratings: 4, average: 5 });
  finish(ok({ ratings: 2, totalRating: 2 }));
  await first;
  expect(quoteStats()).toMatchObject({ ratings: 4, average: 5 });
});
