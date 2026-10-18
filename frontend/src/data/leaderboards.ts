import { queryOptions } from "@tanstack/solid-query";
import type {
  LeaderboardPage,
  Selection,
} from "../features/leaderboards/selection";
import { getLeaderboard } from "../functions/leaderboards";

/** Fields that select a board; weekly boards have no mode/language. */
export function boardKey(selection: Selection): Record<string, unknown> {
  return {
    client: selection.client ?? "web",
    mode: selection.mode,
    mode2: selection.mode2,
    language: selection.language,
    previous: selection.previous,
  };
}

function normalize(selection: Selection): Selection {
  return selection.type === "weekly"
    ? {
        type: "weekly",
        client: selection.client,
        previous: selection.previous,
      }
    : selection;
}

export const leaderboardOptions = (
  selection: Selection,
  page: number,
): ReturnType<typeof queryOptions<LeaderboardPage>> =>
  queryOptions<LeaderboardPage>({
    queryKey: [
      "public",
      "leaderboard",
      selection.type,
      boardKey(selection),
      { page },
    ],
    queryFn: async ({ signal }) =>
      await getLeaderboard({
        data: { selection: normalize(selection), page },
        signal,
      }),
    // All-time ranks update every 5 minutes; daily/weekly boards live.
    staleTime: selection.type === "allTime" ? 300_000 : 60_000,
    meta: { ssrSafe: true },
  });
