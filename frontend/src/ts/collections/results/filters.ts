import { ResultsQueryState } from "./types";
import { Client } from "@oxytype/schemas/shared";
import { ResultFilters } from "@oxytype/schemas/users";

export function createResultsQueryState(
  filters: ResultFilters,
  client: Client = "web",
): ResultsQueryState {
  return {
    client,
    difficulty: valueFilter(filters.difficulty),
    pb: boolFilter(filters.pb),
    mode: valueFilter(filters.mode),
    words: valueFilter(filters.words),
    time: valueFilter(filters.time),
    punctuation: boolFilter(filters.punctuation),
    numbers: boolFilter(filters.numbers),
    timestamp: timestampFilter(filters.date),
    quoteLength: [
      ...valueFilter(filters.quoteLength, {
        short: 0,
        medium: 1,
        long: 2,
        thicc: 3,
      }),
      -1, // fallback value for results without quoteLength, set in the collection
    ],
    tags: valueFilter(filters.tags),
    funbox: valueFilter(filters.funbox),
    language: valueFilter(filters.language),
  };
}

function valueFilter<T extends string, U = T>(
  val: Partial<Record<T, boolean>>,
  mapping?: Record<T, U>,
): U[] {
  return Object.entries(val)
    .filter(([_, v]) => v === true)
    .map(([k]) => k as T)
    .map((it) => (mapping ? mapping[it] : (it as unknown as U)));
}

function boolFilter(
  val: Record<"on" | "off", boolean> | Record<"yes" | "no", boolean>,
): boolean[] {
  return Object.entries(val)
    .filter(([_, v]) => v)
    .map(([k]) => k === "on" || k === "yes");
}

function timestampFilter(val: ResultFilters["date"]): number {
  const seconds =
    valueFilter(val, {
      all: 0,
      last_day: 24 * 60 * 60,
      last_week: 7 * 24 * 60 * 60,
      last_month: 30 * 24 * 60 * 60,
      last_3months: 90 * 24 * 60 * 60,
    })[0] ?? 0;

  if (seconds === 0) return 0;
  return Math.floor(Date.now() - seconds * 1000);
}
