import { getQueryClient } from ".";
import {
  getContributorsQueryOptions,
  getSpeedHistogramQueryOptions,
  getTypingStatsQueryOptions,
} from "./public";
import { getLeaderboardQueryOptions } from "./leaderboards";

export function prefetchAboutPage(): void {
  void getQueryClient()
    .query(getContributorsQueryOptions())
    .catch(() => undefined);
  void getQueryClient()
    .query(getTypingStatsQueryOptions())
    .catch(() => undefined);
  void getQueryClient()
    .query(getSpeedHistogramQueryOptions())
    .catch(() => undefined);
}

export function prefetchLeaderboardPage(): void {
  void getQueryClient()
    .query(
      getLeaderboardQueryOptions({
        type: "allTime",
        mode: "time",
        mode2: "15",
        language: "english",
        page: 0,
        previous: false,
      }),
    )
    .catch(() => undefined);
}
