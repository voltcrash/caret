import type { Client } from "@oxytype/schemas/shared";
import { MonkeyResponse } from "../../utils/monkey-response";
import * as LeaderboardsDAL from "../../dal/leaderboards";
import MonkeyError from "../../utils/error";
import * as DailyLeaderboards from "../../utils/daily-leaderboards";
import * as WeeklyXpLeaderboard from "../../services/weekly-xp-leaderboard";
import {
  DailyLeaderboardQuery,
  GetDailyLeaderboardQuery,
  GetDailyLeaderboardRankQuery,
  GetDailyLeaderboardResponse,
  GetLeaderboardDailyRankResponse,
  GetLeaderboardQuery,
  GetLeaderboardRankQuery,
  GetLeaderboardRankResponse,
  GetLeaderboardResponse,
  GetWeeklyXpLeaderboardQuery,
  GetWeeklyXpLeaderboardRankQuery,
  GetWeeklyXpLeaderboardRankResponse,
  GetWeeklyXpLeaderboardResponse,
} from "@oxytype/contracts/leaderboards";
import { Configuration } from "@oxytype/schemas/configuration";
import {
  getCurrentDayTimestamp,
  getCurrentWeekTimestamp,
  MILLISECONDS_IN_DAY,
} from "@oxytype/util/date-and-time";
import type { ServiceContext, OperationInput } from "../context";
import { omit } from "../../utils/misc";

export async function getLeaderboard(
  context: ServiceContext,
  input: OperationInput<GetLeaderboardQuery>,
): Promise<GetLeaderboardResponse> {
  const { language, mode, mode2, page, pageSize } = input.query;

  if (
    mode !== "time" ||
    (mode2 !== "15" && mode2 !== "60") ||
    language !== "english"
  ) {
    throw new MonkeyError(404, "There is no leaderboard for this mode");
  }

  const leaderboard = await LeaderboardsDAL.get(
    mode,
    mode2,
    language,
    page,
    pageSize,
    context.configuration.users.premium.enabled,
    input.query.client,
  );

  const count = await LeaderboardsDAL.getCount(
    mode,
    mode2,
    language,
    input.query.client,
  );
  const normalizedLeaderboard = leaderboard.map((it) => omit(it, ["_id"]));

  return new MonkeyResponse("Leaderboard retrieved", {
    count,
    entries: normalizedLeaderboard,
    pageSize,
  });
}

export async function getRankFromLeaderboard(
  context: ServiceContext,
  input: OperationInput<GetLeaderboardRankQuery>,
): Promise<GetLeaderboardRankResponse> {
  const { language, mode, mode2 } = input.query;
  const { uid } = context.actor;

  const data = await LeaderboardsDAL.getRank(
    mode,
    mode2,
    language,
    uid,
    input.query.client,
  );

  if (data === null) {
    return new MonkeyResponse("Rank retrieved", null);
  }

  return new MonkeyResponse("Rank retrieved", omit(data, ["_id"]));
}

function getDailyLeaderboardWithError(
  { language, mode, mode2, daysBefore, client }: DailyLeaderboardQuery,
  config: Configuration["dailyLeaderboards"],
): DailyLeaderboards.DailyLeaderboard {
  const customTimestamp =
    daysBefore === undefined
      ? -1
      : getCurrentDayTimestamp() - daysBefore * MILLISECONDS_IN_DAY;

  const dailyLeaderboard = DailyLeaderboards.getDailyLeaderboard(
    language,
    mode,
    mode2,
    config,
    customTimestamp,
    client,
  );
  if (!dailyLeaderboard) {
    throw new MonkeyError(404, "There is no daily leaderboard for this mode");
  }

  return dailyLeaderboard;
}

export async function getDailyLeaderboard(
  context: ServiceContext,
  input: OperationInput<GetDailyLeaderboardQuery>,
): Promise<GetDailyLeaderboardResponse> {
  const { page, pageSize } = input.query;

  const dailyLeaderboard = getDailyLeaderboardWithError(
    input.query,
    context.configuration.dailyLeaderboards,
  );

  const results = await dailyLeaderboard.getResults(
    page,
    pageSize,
    context.configuration.dailyLeaderboards,
    context.configuration.users.premium.enabled,
  );

  return new MonkeyResponse("Daily leaderboard retrieved", {
    entries: results?.entries ?? [],
    count: results?.count ?? 0,
    minWpm: results?.minWpm ?? 0,
    pageSize,
  });
}

export async function getDailyLeaderboardRank(
  context: ServiceContext,
  input: OperationInput<GetDailyLeaderboardRankQuery>,
): Promise<GetLeaderboardDailyRankResponse> {
  const { uid } = context.actor;

  const dailyLeaderboard = getDailyLeaderboardWithError(
    input.query,
    context.configuration.dailyLeaderboards,
  );

  const rank = await dailyLeaderboard.getRank(
    uid,
    context.configuration.dailyLeaderboards,
  );

  return new MonkeyResponse("Daily leaderboard rank retrieved", rank);
}

function getWeeklyXpLeaderboardWithError(
  config: Configuration["leaderboards"]["weeklyXp"],
  weeksBefore?: number,
  client: Client = "web",
): WeeklyXpLeaderboard.WeeklyXpLeaderboard {
  const customTimestamp =
    weeksBefore === undefined
      ? -1
      : getCurrentWeekTimestamp() - weeksBefore * MILLISECONDS_IN_DAY * 7;

  const weeklyXpLeaderboard = WeeklyXpLeaderboard.get(
    config,
    customTimestamp,
    client,
  );
  if (!weeklyXpLeaderboard) {
    throw new MonkeyError(404, "XP leaderboard for this week not found.");
  }

  return weeklyXpLeaderboard;
}

export async function getWeeklyXpLeaderboard(
  context: ServiceContext,
  input: OperationInput<GetWeeklyXpLeaderboardQuery>,
): Promise<GetWeeklyXpLeaderboardResponse> {
  const { page, pageSize, weeksBefore } = input.query;

  const weeklyXpLeaderboard = getWeeklyXpLeaderboardWithError(
    context.configuration.leaderboards.weeklyXp,
    weeksBefore,
    input.query.client,
  );
  const results = await weeklyXpLeaderboard.getResults(
    page,
    pageSize,
    context.configuration.leaderboards.weeklyXp,
    context.configuration.users.premium.enabled,
  );

  return new MonkeyResponse("Weekly xp leaderboard retrieved", {
    entries: results?.entries ?? [],
    count: results?.count ?? 0,
    pageSize,
  });
}

export async function getWeeklyXpLeaderboardRank(
  context: ServiceContext,
  input: OperationInput<GetWeeklyXpLeaderboardRankQuery>,
): Promise<GetWeeklyXpLeaderboardRankResponse> {
  const { uid } = context.actor;

  const weeklyXpLeaderboard = getWeeklyXpLeaderboardWithError(
    context.configuration.leaderboards.weeklyXp,
    input.query.weeksBefore,
    input.query.client,
  );
  const rankEntry = await weeklyXpLeaderboard.getRank(
    uid,
    context.configuration.leaderboards.weeklyXp,
  );

  return new MonkeyResponse("Weekly xp leaderboard rank retrieved", rankEntry);
}
