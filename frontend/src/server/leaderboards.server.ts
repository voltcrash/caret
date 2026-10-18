import "@tanstack/solid-start/server-only";
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

/** One leaderboard page; each type keeps its own operation, gates and limits. */
export async function readLeaderboard(
  context: ServiceContext,
  selection: Selection,
  page: number,
): Promise<LeaderboardPage> {
  const client = selection.client ?? "web";
  const base = { client, pageSize, page };
  if (selection.type === "weekly") {
    return await runOperation(context, "leaderboards.getWeeklyXp", {
      query: { ...base, weeksBefore: selection.previous ? 1 : undefined },
    });
  }
  const mode = {
    ...base,
    mode: selection.mode,
    mode2: selection.mode2,
    language: selection.language,
  };
  if (selection.type === "allTime") {
    return await runOperation(context, "leaderboards.get", { query: mode });
  }
  return await runOperation(context, "leaderboards.getDaily", {
    query: { ...mode, daysBefore: selection.previous ? 1 : undefined },
  });
}

/** The signed-in actor's rank; authentication is enforced by each operation. */
export async function readLeaderboardRank(
  context: ServiceContext,
  selection: Selection,
): Promise<LeaderboardEntry | XpLeaderboardEntry | null> {
  const client = selection.client ?? "web";
  if (selection.type === "weekly") {
    return await runOperation(context, "leaderboards.getWeeklyXpRank", {
      query: { client, weeksBefore: selection.previous ? 1 : undefined },
    });
  }
  const mode = {
    client,
    mode: selection.mode,
    mode2: selection.mode2,
    language: selection.language,
  };
  if (selection.type === "allTime") {
    return await runOperation(context, "leaderboards.getRank", { query: mode });
  }
  return await runOperation(context, "leaderboards.getDailyRank", {
    query: { ...mode, daysBefore: selection.previous ? 1 : undefined },
  });
}
