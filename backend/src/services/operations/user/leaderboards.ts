import type { Client, ClientQuery } from "@oxytype/schemas/shared";
import * as UserDAL from "../../../dal/user";
import { MonkeyResponse } from "../../../utils/monkey-response";
import * as LeaderboardsDAL from "../../../dal/leaderboards";
import { purgeUserFromDailyLeaderboards } from "../../../utils/daily-leaderboards";
import { purgeUserFromXpLeaderboards } from "../../../services/weekly-xp-leaderboard";
import { AllTimeLbs } from "@oxytype/schemas/users";
import { addImportantLog } from "../../../dal/logs";
import { UpdateLeaderboardMemoryRequest } from "@oxytype/contracts/users";
import type { ServiceContext, OperationInput } from "../../context";

export async function clearPb(
  context: ServiceContext,
  input: OperationInput<ClientQuery>,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;

  await UserDAL.clearPb(uid, input.query?.client);
  await purgeUserFromDailyLeaderboards(
    uid,
    context.configuration.dailyLeaderboards,
    input.query?.client ?? "web",
  );
  void addImportantLog("user_cleared_pbs", "", uid);

  return new MonkeyResponse("User's PB cleared", null);
}
export async function optOutOfLeaderboards(
  context: ServiceContext,
  _input: OperationInput,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;

  await UserDAL.optOutOfLeaderboards(uid);
  await purgeUserFromDailyLeaderboards(
    uid,
    context.configuration.dailyLeaderboards,
  );
  await purgeUserFromXpLeaderboards(
    uid,
    context.configuration.leaderboards.weeklyXp,
  );
  void addImportantLog("user_opted_out_of_leaderboards", "", uid);

  return new MonkeyResponse("User opted out of leaderboards", null);
}
export async function updateLbMemory(
  context: ServiceContext,
  input: OperationInput<ClientQuery, UpdateLeaderboardMemoryRequest>,
): Promise<MonkeyResponse> {
  const { uid } = context.actor;
  const { mode, language, rank } = input.body;
  const mode2 = input.body.mode2;

  await UserDAL.updateLbMemory(
    uid,
    mode,
    mode2,
    language,
    rank,
    input.query?.client,
  );
  return new MonkeyResponse("Leaderboard memory updated", null);
}
export async function getAllTimeLbs(
  uid: string,
  client: Client = "web",
): Promise<AllTimeLbs> {
  const allTime15English = await LeaderboardsDAL.getRank(
    "time",
    "15",
    "english",
    uid,
    client,
  );

  const allTime15EnglishCount = await LeaderboardsDAL.getCount(
    "time",
    "15",
    "english",
    client,
  );

  const allTime60English = await LeaderboardsDAL.getRank(
    "time",
    "60",
    "english",
    uid,
    client,
  );

  const allTime60EnglishCount = await LeaderboardsDAL.getCount(
    "time",
    "60",
    "english",
    client,
  );

  const english15 =
    allTime15English === null
      ? undefined
      : {
          rank: allTime15English.rank,
          count: allTime15EnglishCount,
        };

  const english60 =
    allTime60English === null
      ? undefined
      : {
          rank: allTime60English.rank,
          count: allTime60EnglishCount,
        };

  return {
    time: {
      "15": {
        english: english15,
      },
      "60": {
        english: english60,
      },
    },
  };
}
