import "@tanstack/solid-start/server-only";
import {
  getDailyLeaderboard,
  getDailyLeaderboardRank,
  getLeaderboard,
  getRankFromLeaderboard,
  getWeeklyXpLeaderboard,
  getWeeklyXpLeaderboardRank,
} from "@oxytype/backend/services/leaderboards";
import type {
  LeaderboardEntry,
  XpLeaderboardEntry,
} from "@oxytype/schemas/leaderboards";
import {
  type LeaderboardPage,
  pageSize,
  type Selection,
} from "../features/leaderboards/selection";
import { runOperation } from "./operation.server";
import type { ServiceContext } from "./context.server";

const none = { body: undefined, params: undefined } as const;

/** One leaderboard page; each type keeps its own operation, gates and limits. */
export async function readLeaderboard(
  context: ServiceContext,
  selection: Selection,
  page: number,
): Promise<LeaderboardPage> {
  const client = selection.client ?? "web";
  const base = { client, pageSize, page };
  if (selection.type === "weekly") {
    return (
      await runOperation(
        context,
        "leaderboards.getWeeklyXp",
        {
          ...none,
          query: { ...base, weeksBefore: selection.previous ? 1 : undefined },
        },
        getWeeklyXpLeaderboard,
      )
    ).data;
  }
  const mode = {
    ...base,
    mode: selection.mode,
    mode2: selection.mode2,
    language: selection.language,
  };
  if (selection.type === "allTime") {
    return (
      await runOperation(
        context,
        "leaderboards.get",
        { ...none, query: mode },
        getLeaderboard,
      )
    ).data;
  }
  return (
    await runOperation(
      context,
      "leaderboards.getDaily",
      {
        ...none,
        query: { ...mode, daysBefore: selection.previous ? 1 : undefined },
      },
      getDailyLeaderboard,
    )
  ).data;
}

/** The signed-in actor's rank; authentication is enforced by each operation. */
export async function readLeaderboardRank(
  context: ServiceContext,
  selection: Selection,
): Promise<LeaderboardEntry | XpLeaderboardEntry | null> {
  const client = selection.client ?? "web";
  if (selection.type === "weekly") {
    return (
      await runOperation(
        context,
        "leaderboards.getWeeklyXpRank",
        {
          ...none,
          query: { client, weeksBefore: selection.previous ? 1 : undefined },
        },
        getWeeklyXpLeaderboardRank,
      )
    ).data;
  }
  const mode = {
    client,
    mode: selection.mode,
    mode2: selection.mode2,
    language: selection.language,
  };
  if (selection.type === "allTime") {
    return (
      await runOperation(
        context,
        "leaderboards.getRank",
        { ...none, query: mode },
        getRankFromLeaderboard,
      )
    ).data;
  }
  return (
    await runOperation(
      context,
      "leaderboards.getDailyRank",
      {
        ...none,
        query: { ...mode, daysBefore: selection.previous ? 1 : undefined },
      },
      getDailyLeaderboardRank,
    )
  ).data;
}
