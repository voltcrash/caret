import { resultsCollection } from "./store";
import { CurrentSettingsFilter } from "./types";
import {
  avg,
  eq,
  gte,
  inArray,
  length,
  or,
  Query,
  queryOnce,
  useLiveQuery,
} from "@tanstack/solid-db";
import { Accessor, createMemo } from "solid-js";
import { isAuthenticated } from "../../states/core";
import { getActiveTagsOnce, useActiveTagsLiveQuery } from "../tags";
import { getConfig } from "../../config/store";
import { getMode2 } from "../../utils/misc";
import { getCurrentQuote } from "../../states/test";
import { removeLanguageSize } from "../../utils/strings";

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
export async function getResultsSinceDayOnce(dayTimestamp: number) {
  return queryOnce((q) =>
    q
      .from({ r: resultsCollection() })
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

function buildSettingsResultsQuery(
  filter: CurrentSettingsFilter,
  options?: { tagIds?: string[] },
) {
  const tagIds = options?.tagIds;
  const funbox = [...new Set(filter.funbox)];

  let query = new Query()
    .from({ r: resultsCollection() })
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
