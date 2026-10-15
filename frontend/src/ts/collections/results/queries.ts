import { resultsByClient } from "./store";
import { queryKeys } from "./keys";
import { ResultsQueryState } from "./types";
import { Mode } from "@oxytype/schemas/shared";
import {
  eq,
  gte,
  inArray,
  length,
  not,
  or,
  Query,
  queryOnce,
  useLiveQuery,
} from "@tanstack/solid-db";
import { queryOptions } from "@tanstack/solid-query";
import { Accessor } from "solid-js";
import Ape from "../../ape";
import { SnapshotResult } from "../../constants/default-snapshot";
import { isAuthenticated } from "../../states/core";

export async function getResultsQueryOnce(options: {
  queryState: Accessor<ResultsQueryState | undefined>;
  sorting: Accessor<{
    field: keyof SnapshotResult<Mode>;
    direction: "asc" | "desc";
  }>;
}) {
  const state = options.queryState();
  if (!state) return undefined;

  const sorting = options.sorting();

  return queryOnce((q) =>
    q
      .from({ r: buildResultsQuery(state) })
      .orderBy(({ r }) => r[sorting.field], sorting.direction),
  );
}

/**
 * get list of SnapshotResults for the current result selection
 * @param queryState
 * @returns
 */
export function useResultsLiveQuery(options: {
  queryState: Accessor<ResultsQueryState | undefined>;
  sorting: Accessor<{
    field: keyof SnapshotResult<Mode>;
    direction: "asc" | "desc";
  }>;
  limit: Accessor<number>;
}) {
  return useLiveQuery((q) => {
    if (!isAuthenticated()) return undefined;
    const state = options.queryState();
    const sorting = options.sorting();
    const limit = options.limit();
    if (state === undefined) return undefined;

    return q
      .from({ r: buildResultsQuery(state) })
      .orderBy(({ r }) => r[sorting.field], sorting.direction)
      .limit(limit);
  });
}

export function buildResultsQuery(state: ResultsQueryState) {
  const applyMode2Filter = <T extends "time" | "words">(
    key: T,
    filter: ResultsQueryState[T],
    nonCustomValues: string[],
  ): void => {
    if (filter.length === 5) return;
    const isCustom = filter.includes("custom");
    const selected = filter.filter((it) => it !== "custom");
    query = query.where(({ r }) =>
      or(
        //results not matching the mode pass
        not(eq(r.mode, key)),

        //mode2 is matching one of the  selected mode2
        inArray(r.mode2, selected),
        //or if custom selected are not matching any non-custom value
        isCustom ? not(inArray(r.mode2, nonCustomValues)) : false,
      ),
    );
  };

  let query = new Query()
    .from({ r: resultsByClient[state.client ?? "web"]() })
    .where(({ r }) => gte(r.timestamp, state.timestamp))
    .where(({ r }) => inArray(r.difficulty, state.difficulty))
    .where(({ r }) => inArray(r.isPb, state.pb))
    .where(({ r }) => inArray(r.mode, state.mode))
    .where(({ r }) => inArray(r.punctuation, state.punctuation))
    .where(({ r }) => inArray(r.numbers, state.numbers))
    .where(({ r }) => inArray(r.quoteLength, state.quoteLength))
    .where(({ r }) => inArray(r.language, state.language))
    .where(({ r }) =>
      or(
        false,
        false,
        ...state.tags.map((tag) =>
          tag === "none" ? eq(length(r.tags), 0) : inArray(tag, r.tags),
        ),
      ),
    )
    .where(({ r }) =>
      or(
        false,
        false,
        ...state.funbox.map((fb) =>
          (fb as string) === "none"
            ? eq(length(r.funbox), 0)
            : inArray(fb, r.funbox),
        ),
      ),
    );
  applyMode2Filter("time", state.time, ["15", "30", "60", "120"]);
  applyMode2Filter("words", state.words, ["10", "25", "50", "100"]);

  return query;
}

export const getSingleResultQueryOptions = (_id: string) =>
  queryOptions({
    queryKey: queryKeys.fullResult(_id),
    queryFn: async () => {
      const response = await Ape.results.getById({ params: { resultId: _id } });

      if (response.status !== 200) {
        throw new Error(`Failed to load result: ${response.body.message}`);
      }
      return response.body.data;
    },
    staleTime: Infinity,
  });
