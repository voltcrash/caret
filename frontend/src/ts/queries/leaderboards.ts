import { baseKey } from "./utils/keys";
import type {
  GetLeaderboardQuery,
  GetLeaderboardRankQuery,
} from "@oxytype/contracts/leaderboards";
import { queryOptions } from "@tanstack/solid-query";
import { operation } from "../../data/operations";
import {
  getPage,
  getSelection,
  pageSize,
  Selection,
  setPage,
} from "../states/leaderboard-selection";

const queryKeys = {
  root: (options: Selection & { userSpecific?: true }) => [
    //don't use baseKey, we require the key to have the options at the same position for user and non user specific
    ...(options.userSpecific === true
      ? baseKey("leaderboard", { isUserSpecific: true })
      : ["leaderboard"]),
    "leaderboard",
    options.type,
    {
      client: options.client ?? "web",
      mode: options.mode,
      mode2: options.mode2,
      language: options.language,
      previous: options.previous,
    },
  ],
  data: (options: Selection & { page: number }) => [
    ...queryKeys.root(options),
    { page: options.page },
  ],
  rank: (options: Selection) =>
    queryKeys.root({ ...options, userSpecific: true }), //rank is always user specific
};

export const getLeaderboardQueryOptions = (
  options: Selection & {
    page: number;
  },
) =>
  queryOptions({
    queryKey: queryKeys.data(options),
    queryFn: async () => {
      const baseQuery = {
        client: options.client ?? "web",
        pageSize,
        page: options.page,
      };

      let request;

      if (options.type === "weekly") {
        request = operation("leaderboards.getWeeklyXp", {
          query: {
            ...baseQuery,
            weeksBefore: options.previous ? 1 : undefined,
          },
        });
      } else {
        const modeQuery: GetLeaderboardQuery = {
          ...baseQuery,
          mode: options.mode,
          mode2: options.mode2,
          language: options.language,
        };

        if (options.type === "allTime") {
          request = operation("leaderboards.get", { query: modeQuery });
        } else {
          request = operation("leaderboards.getDaily", {
            query: {
              ...modeQuery,
              daysBefore: options.previous ? 1 : undefined,
            },
          });
        }
      }

      const response = await request;
      if (!response.ok) {
        throw new Error(
          `Failed to get ${options.type} leaderboard data: ${response.message}`,
        );
      }

      if (
        response.data.entries.length === 0 &&
        options.page !== 0 &&
        getPage() === options.page &&
        (getSelection().client ?? "web") === (options.client ?? "web") &&
        getSelection().type === options.type &&
        getSelection().previous === options.previous &&
        getSelection().mode === options.mode &&
        getSelection().mode2 === options.mode2 &&
        getSelection().language === options.language
      ) {
        const page = Math.max(0, Math.ceil(response.data.count / pageSize) - 1);
        if (page !== options.page) {
          setPage(page);
        }
      }
      return response.data;
    },
    //5 minutes for alltime, one minute for others
    staleTime: options.type === "allTime" ? 1000 * 60 * 5 : 1000 * 60,
  });

export const getRankQueryOptions = (options: Selection) =>
  queryOptions({
    queryKey: queryKeys.rank(options),
    queryFn: async () => {
      let request;
      if (options.type === "weekly") {
        request = operation("leaderboards.getWeeklyXpRank", {
          query: {
            client: options.client ?? "web",
            weeksBefore: options.previous ? 1 : undefined,
          },
        });
      } else {
        const baseQuery: GetLeaderboardRankQuery = {
          client: options.client ?? "web",
          mode: options.mode,
          mode2: options.mode2,
          language: options.language,
        };
        if (options.type === "allTime") {
          request = operation("leaderboards.getRank", { query: baseQuery });
        } else {
          request = operation("leaderboards.getDailyRank", {
            query: {
              ...baseQuery,
              daysBefore: options.previous ? 1 : undefined,
            },
          });
        }
      }

      const response = await request;
      if (!response.ok) {
        throw new Error(
          `Failed to get ${options.type} leaderboard rank: ${response.message}`,
        );
      }
      return response.data;
    },
    //5 minutes for alltime, one minute for others
    staleTime: options.type === "allTime" ? 1000 * 60 * 5 : 1000 * 60,
  });
