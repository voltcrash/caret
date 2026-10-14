import { buildResultsQuery } from "./queries";
import { ResultsQueryState } from "./types";
import { avg, count, max, sum, useLiveQuery } from "@tanstack/solid-db";
import { Accessor } from "solid-js";
import { isAuthenticated } from "../../states/core";

/**
 * get aggregated statistics for the current result selection
 * @param queryState
 * @param options
 * @returns
 */
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
