import type { Client, ClientQuery } from "@caret/schemas/shared";
import * as UserDAL from "../../../dal/user";
import { MonkeyResponse } from "../../../utils/monkey-response";
import * as LeaderboardsDAL from "../../../dal/leaderboards";
import { purgeUserFromDailyLeaderboards } from "../../../utils/daily-leaderboards";
import { purgeUserFromXpLeaderboards } from "../../../services/weekly-xp-leaderboard";
import { AllTimeLbs } from "@caret/schemas/users";
import { addImportantLog } from "../../../dal/logs";
import { UpdateLeaderboardMemoryRequest } from "@caret/contracts/users";
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
  _client: Client = "web",
): Promise<AllTimeLbs> {
  const ranks = await LeaderboardsDAL.getUserRanks(uid, [
    "english_time_15",
    "english_time_60",
  ]);

  return {
    time: {
      "15": {
        english: ranks["english_time_15"],
      },
      "60": {
        english: ranks["english_time_60"],
      },
    },
  };
}
