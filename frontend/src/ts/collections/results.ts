export { createResultsQueryState } from "./results/filters";
export {
  updateTags,
  insertLocalResult,
  deleteLocalTag,
} from "./results/mutations";
import { resultsByClient, resultsCollection } from "./results/store";
export { isResultsReady, waitForResultsReady } from "./results/store";
import { queryKeys } from "./results/keys";

import { ResultsQueryState, CurrentSettingsFilter } from "./results/types";
export {
  type ResultsQueryState,
  type ResultStats,
  type CurrentSettingsFilter,
} from "./results/types";

import { Mode } from "@oxytype/schemas/shared";

import {
  avg,
  count,
  eq,
  gte,
  inArray,
  length,
  max,
  not,
  or,
  Query,
  queryOnce,
  sum,
  useLiveQuery,
} from "@tanstack/solid-db";
import { queryOptions } from "@tanstack/solid-query";
import { Accessor, createMemo } from "solid-js";
import Ape from "../ape";
import { SnapshotResult } from "../constants/default-snapshot";
import { createModuleEffectOn } from "../hooks/effects";

import { isAuthenticated } from "../states/core";

import { getActiveTagsOnce, useActiveTagsLiveQuery } from "./tags";

import { getConfig } from "../config/store";
import { getMode2 } from "../utils/misc";
import { getCurrentQuote } from "../states/test";
import { removeLanguageSize } from "../utils/strings";

/**
 * get aggregated statistics for the current result selection
 * @param queryState
 * @param options
 * @returns
 */
// oxlint-disable-next-line typescript/explicit-function-return-type
export function useResultStatsLiveQuery(
  queryState: Accessor<ResultsQueryState | undefined>,
  options?: { lastTen?: true } | { groupByDay?: true },
) {
  return useLiveQuery((q) => {
    if (!isAuthenticated()) return undefined;
    const state = queryState();
    if (state === undefined) return undefined;

    const isLastTen =
      options !== undefined && "lastTen" in options && options.lastTen;
    const isGroupByDay =
      options !== undefined && "groupByDay" in options && options.groupByDay;

    let query = isLastTen
      ? //for lastTen we need a sub-query to apply the sort+limit first and then run the aggregations
        q.from({
          r: q
            .from({ r: buildResultsQuery(state) })
            .orderBy(({ r }) => r.timestamp, "desc")
            .limit(10),
        })
      : q.from({ r: buildResultsQuery(state) });

    if (isGroupByDay) {
      query = query.groupBy(({ r }) => r.dayTimestamp);
    }

    return query.select(({ r }) => ({
      dayTimestamp: isGroupByDay ? r.dayTimestamp : undefined,
      words: sum(r.words),
      completed: count(r._id),
      restarted: sum(r.restartCount),
      timeTyping: sum(r.timeTyping),
      maxWpm: max(r.wpm),
      avgWpm: avg(r.wpm),
      maxRaw: max(r.rawWpm),
      avgRaw: avg(r.rawWpm),
      maxAcc: max(r.acc),
      avgAcc: avg(r.acc),
      maxConsistency: max(r.consistency),
      avgConsistency: avg(r.consistency),
    }));
  });
}

// oxlint-disable-next-line typescript/explicit-function-return-type
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
// oxlint-disable-next-line typescript/explicit-function-return-type
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

// oxlint-disable-next-line typescript/explicit-function-return-type
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
    .from({ r: resultsByClient[state.client ?? "web"] })
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

// oxlint-disable-next-line typescript/explicit-function-return-type
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

// oxlint-disable-next-line typescript/explicit-function-return-type
export function useUserAverage10LiveQuery(options: {
  isEnabled: Accessor<boolean>;
}) {
  const settingsFilter = createMemo(() => {
    const language =
      getConfig.mode === "quote"
        ? removeLanguageSize(getConfig.language)
        : getConfig.language;

    return {
      ...getConfig,
      mode2: getMode2(getConfig, getCurrentQuote()),
      language,
    };
  });

  const activeTagsQuery = useActiveTagsLiveQuery();

  return useLiveQuery((q) => {
    //disable query
    if (!isAuthenticated()) return undefined;
    if (!options.isEnabled()) return undefined;

    return q
      .from({
        //we use sub-query to filter first and then aggregate
        last10: buildSettingsResultsQuery(settingsFilter(), {
          tagIds: activeTagsQuery().map((it) => it._id),
        })
          .orderBy(({ r }) => r.timestamp, "desc")
          .limit(10),
      })
      .select(({ last10 }) => ({ wpm: avg(last10.wpm), acc: avg(last10.acc) }))
      .findOne();
  });
}

/**
 * web results from the local day starting at `dayTimestamp` onwards
 */
// oxlint-disable-next-line typescript/explicit-function-return-type
export async function getResultsSinceDayOnce(dayTimestamp: number) {
  return queryOnce((q) =>
    q
      .from({ r: resultsCollection })
      .where(({ r }) => gte(r.dayTimestamp, dayTimestamp)),
  );
}

export async function getUserAverage10Once(
  options: CurrentSettingsFilter,
): Promise<{ wpm: number; acc: number }> {
  //exit early if there is no user. Don't init the result collection
  if (!isAuthenticated()) return { wpm: 0, acc: 0 };
  const tagIds = (await getActiveTagsOnce()).map((it) => it._id);

  const result = await queryOnce((q) =>
    q
      .from({
        //we use sub-query to filter first and then aggregate
        last10: buildSettingsResultsQuery(options, { tagIds })
          .orderBy(({ r }) => r.timestamp, "desc")
          .limit(10),
      })
      .select(({ last10 }) => ({ wpm: avg(last10.wpm), acc: avg(last10.acc) }))
      .findOne(),
  );

  return result ?? { wpm: 0, acc: 0 };
}

export async function getUserDailyBestOnce(
  options: CurrentSettingsFilter,
): Promise<{ wpm: number; acc: number }> {
  //exit early if there is no user. Don't init the result collection
  if (!isAuthenticated()) return { wpm: 0, acc: 0 };
  const tagIds = (await getActiveTagsOnce()).map((it) => it._id);

  const result = await queryOnce(() =>
    buildSettingsResultsQuery(options, { tagIds })
      .where(({ r }) => gte(r.timestamp, Date.now() - 24 * 60 * 60 * 1000))
      .orderBy(({ r }) => r.wpm, "desc")
      .limit(1)
      .findOne(),
  );

  return result ?? { wpm: 0, acc: 0 };
}

// oxlint-disable-next-line typescript/explicit-function-return-type
function buildSettingsResultsQuery(
  filter: CurrentSettingsFilter,
  options?: { tagIds?: string[] },
) {
  const tagIds = options?.tagIds;
  const funbox = [...new Set(filter.funbox)];

  let query = new Query()
    .from({ r: resultsCollection })
    .where(({ r }) => eq(r.mode, filter.mode))
    .where(({ r }) => eq(r.mode2, filter.mode2))
    .where(({ r }) => eq(r.punctuation, filter.punctuation))
    .where(({ r }) => eq(r.numbers, filter.numbers))
    .where(({ r }) => eq(r.language, filter.language))
    .where(({ r }) => eq(r.difficulty, filter.difficulty))
    .where(({ r }) => eq(r.lazyMode, filter.lazyMode))
    .where(({ r }) => eq(length(r.funbox), funbox.length));

  // Exact set equality: order must not mix or exclude equivalent combinations.
  for (const name of funbox) {
    query = query.where(({ r }) => inArray(name, r.funbox));
  }

  if (tagIds !== undefined) {
    query = query.where(({ r }) =>
      or(
        false,
        tagIds.length === 0,
        ...tagIds.map((it) => inArray(it, r.tags)),
      ),
    );
  }

  return query;
}

/**
 *
 */
createModuleEffectOn(import.meta.hot, isAuthenticated, (hasUser) => {
  if (hasUser) {
    void resultsCollection.utils.refetch();
    if (resultsByClient.tui.isReady()) void resultsByClient.tui.utils.refetch();
  }
});
