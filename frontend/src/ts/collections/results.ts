import { queryKeys } from "./results/keys";
import { normalizeResult } from "./results/normalize";
import {
  ResultsQueryState,
  CurrentSettingsFilter,
  UpdateTagsResult,
  ActionType,
} from "./results/types";
export {
  type ResultsQueryState,
  type ResultStats,
  type CurrentSettingsFilter,
} from "./results/types";

import { Client, Mode } from "@oxytype/schemas/shared";
import { ResultFilters } from "@oxytype/schemas/users";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import {
  avg,
  BTreeIndex,
  count,
  createCollection,
  createOptimisticAction,
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
import { queryClient } from "../queries";

import { isAuthenticated } from "../states/core";
import { getLastResult, setLastResult } from "../states/snapshot";
import {
  getActiveTagsOnce,
  getTagsOnce,
  reconcileLocalTagPB,
  saveLocalTagPB,
  useActiveTagsLiveQuery,
} from "./tags";
import { applyIdWorkaround } from "./utils/misc";
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
function createResultsCollection(client: Client) {
  const collection = createCollection(
    queryCollectionOptions({
      staleTime: Infinity,
      // Web's synchronous typing/PB consumers still require retained data.
      // Terminal history can refetch after five minutes without subscribers.
      gcTime: client === "web" ? Infinity : 5 * 60 * 1000,
      queryKey: queryKeys.root(client),
      enabled: isAuthenticated,
      queryFn: async () => {
        const tagIds = await getTagsOnce();
        const knownTagIds = new Set([...tagIds.map((it) => it._id)]);
        //const options = parseLoadSubsetOptions(ctx.meta?.loadSubsetOptions);

        const response = await Ape.results.get({
          query: { client },
        });

        if (response.status !== 200) {
          throw new Error(`Error fetching results:${response.body.message}`);
        }

        const results = response.body.data
          .map((result) => normalizeResult(result, knownTagIds))
          .map(applyIdWorkaround);

        if (
          client === "web" &&
          getLastResult() === undefined &&
          results.length > 0
        ) {
          const lastResult = results.reduce((acc, cur) =>
            acc === undefined || acc.timestamp < cur.timestamp ? cur : acc,
          );
          setLastResult(lastResult);
        }
        return results;
      },
      queryClient,
      getKey: (it) => it._id,
    }),
  );

  collection.createIndex((row) => row.timestamp, {
    indexType: BTreeIndex,
  });

  import.meta.hot?.dispose(() => {
    void collection.cleanup();
  });
  return collection;
}

const resultsByClient = {
  web: createResultsCollection("web"),
  tui: createResultsCollection("tui"),
};
const resultsCollection = resultsByClient.web;

// oxlint-disable-next-line typescript/explicit-function-return-type
function createActions(client: Client) {
  const resultsCollection = resultsByClient[client];
  const actions = {
    updateTags: createOptimisticAction<
      ActionType["updateTags"] & { persisted: UpdateTagsResult }
    >({
      onMutate: ({ resultId, newTagIds }) => {
        resultsCollection.update(resultId, (result) => {
          result.tags = newTagIds;
        });
      },
      mutationFn: async ({ resultId, currentTagIds, newTagIds, persisted }) => {
        const response = await Ape.results.updateTags({
          body: { resultId, tagIds: newTagIds },
        });
        if (response.status !== 200) {
          throw new Error(
            `Failed to update result tag: ${response.body.message}`,
          );
        }
        const results = getResults(client);
        const result = results.find((it) => it._id === resultId);

        if (result === undefined) {
          throw new Error(`Cannot find result with id ${resultId}`);
        }

        const tagsToUpdate = [
          ...currentTagIds.filter((tag) => !newTagIds.includes(tag)),
          ...newTagIds.filter((tag) => !currentTagIds.includes(tag)),
        ];
        if (client === "web") {
          tagsToUpdate.forEach((tag) => {
            reconcileLocalTagPB(
              tag,
              result.mode,
              result.mode2,
              result.punctuation,
              result.numbers,
              result.language,
              result.difficulty,
              result.lazyMode,
              results,
            );
          });
        }

        resultsCollection.utils.writeUpdate({
          _id: resultId,
          tags: newTagIds,
        });

        persisted.tagPbs = response.body.data.tagPbs;
      },
    }),
    insertLocalResult: createOptimisticAction<ActionType["insertLocalResult"]>({
      onMutate: ({ result }) => {
        resultsCollection.utils.writeInsert(normalizeResult(result));
      },
      mutationFn: async () => {
        //we don't sync the changes back to the backend here, it is done already
        return;
      },
    }),
    deleteLocalTag: createOptimisticAction<ActionType["deleteLocalTag"]>({
      onMutate: ({ tagId }) => {
        for (const result of [...resultsCollection.values()].filter((it) =>
          it.tags.includes(tagId),
        )) {
          resultsCollection.utils.writeUpdate({
            ...result,
            tags: result.tags.filter((it) => it !== tagId),
          });
        }
      },
      mutationFn: async () => {
        //we do not sync the changes back to the backend
        return;
      },
    }),
  };
  return actions;
}
const actionsByClient = {
  web: createActions("web"),
  tui: createActions("tui"),
};
// --- Public API ---
/**
 * @returns ids of tags that got a new personal best from this result
 */
export async function updateTags(
  params: ActionType["updateTags"],
): Promise<UpdateTagsResult> {
  const resultsCollection = resultsByClient[params.client ?? "web"];
  if (!resultsCollection.isReady()) {
    // if its not ready yet, send the api request to update the tags
    const response = await Ape.results.updateTags({
      body: { resultId: params.resultId, tagIds: params.newTagIds },
    });

    if (response.status !== 200) {
      throw new Error(`Failed to update result tag: ${response.body.message}`);
    }

    if (params.client === "tui") {
      return { tagPbs: response.body.data.tagPbs };
    }

    const result = getLastResult();

    if (result === undefined) {
      throw new Error(`Cannot find result with id ${params.resultId}`);
    }

    if (result._id !== params.resultId) {
      throw new Error(
        `Last result id ${result._id} does not match updated result id ${params.resultId}. Call the devs and tell them to fix their ugly code`,
      );
    }

    response.body.data.tagPbs.forEach((tag) => {
      saveLocalTagPB(
        tag,
        result.mode,
        result.mode2,
        result.punctuation,
        result.numbers,
        result.language,
        result.difficulty,
        result.lazyMode,
        result.wpm,
        result.acc,
        result.rawWpm,
        result.consistency,
      );
    });

    return { tagPbs: response.body.data.tagPbs };
  }

  const persisted: UpdateTagsResult = { tagPbs: [] };
  const transaction = actionsByClient[params.client ?? "web"].updateTags({
    ...params,
    persisted,
  });
  await transaction.isPersisted.promise;
  return persisted;
}

export async function insertLocalResult(
  params: ActionType["insertLocalResult"],
): Promise<void> {
  const client = params.result.client ?? "web";
  if (!resultsByClient[client].isReady()) {
    //not loaded yet, don't need to insert
    return;
  }
  const transaction = actionsByClient[client].insertLocalResult(params);
  await transaction.isPersisted.promise;
}

export async function deleteLocalTag(
  params: ActionType["deleteLocalTag"],
): Promise<void> {
  for (const client of ["web", "tui"] as const) {
    if (!resultsByClient[client].isReady()) continue;
    const transaction = actionsByClient[client].deleteLocalTag(params);
    await transaction.isPersisted.promise;
  }
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

export function isResultsReady(): boolean {
  return resultsCollection.isReady();
}

export async function waitForResultsReady(): Promise<void> {
  await resultsCollection.stateWhenReady();
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

function getResults(client: Client = "web"): SnapshotResult<Mode>[] {
  return [...resultsByClient[client].values()];
}
