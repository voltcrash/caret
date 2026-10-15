import { isUniqueViolation } from "../../../db/client";
import { atomicUser } from "../../../db/mutation";

import MonkeyError from "../../../utils/error";

import MonkeyStatusCodes from "../../../constants/monkey-status-codes";
import { getDailyLeaderboard } from "../../../utils/daily-leaderboards";

import * as WeeklyXpLeaderboard from "../../../services/weekly-xp-leaderboard";

import {
  AddResultRequest,
  AddResultResponse,
} from "@oxytype/contracts/results";

import type { ServiceContext, OperationInput } from "../../context";

import { validateSubmission } from "./validation";
import { applyProgression } from "./progression";
export async function addResult(
  context: ServiceContext,
  input: OperationInput<undefined, AddResultRequest>,
): Promise<AddResultResponse> {
  const uid = context.actor.uid;
  const response = await atomicUser(
    uid,
    async () => await addResultAtomic(context, input),
  ).catch((error: unknown) => {
    if (isUniqueViolation(error)) {
      const status = MonkeyStatusCodes.DUPLICATE_RESULT;
      throw new MonkeyError(status.code, "Duplicate result");
    }
    throw error;
  });
  // Rejections before progression may commit their audit/strike writes. Throw
  // only after that batch succeeds; thrown errors inside atomicUser roll back.
  if (response instanceof MonkeyError) throw response;
  // Both ranks are read from committed data, so look them up together.
  await Promise.all([
    (async () => {
      if (response.data.dailyLeaderboardRank === undefined) return;
      const daily = getDailyLeaderboard(
        input.body.result.language,
        input.body.result.mode,
        input.body.result.mode2,
        context.configuration.dailyLeaderboards,
        -1,
        input.body.result.client,
      );
      const entry = await daily?.getRank(
        uid,
        context.configuration.dailyLeaderboards,
      );
      if (entry) response.data.dailyLeaderboardRank = entry.rank;
      else delete response.data.dailyLeaderboardRank;
    })(),
    (async () => {
      if (response.data.weeklyXpLeaderboardRank === undefined) return;
      const weekly = WeeklyXpLeaderboard.get(
        context.configuration.leaderboards.weeklyXp,
        undefined,
        input.body.result.client,
      );
      const entry = await weekly?.getRank(
        uid,
        context.configuration.leaderboards.weeklyXp,
      );
      if (entry) response.data.weeklyXpLeaderboardRank = entry.rank;
      else delete response.data.weeklyXpLeaderboardRank;
    })(),
  ]);
  return response;
}

async function addResultAtomic(
  context: ServiceContext,
  input: OperationInput<undefined, AddResultRequest>,
): Promise<AddResultResponse | MonkeyError> {
  const validated = await validateSubmission(context, input);
  if (validated instanceof MonkeyError) return validated;
  return await applyProgression(validated);
}
