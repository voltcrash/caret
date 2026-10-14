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

import { MonkeyRequest } from "../../types";

import { validateSubmission } from "./validation";
import { applyProgression } from "./progression";
export async function addResult(
  req: MonkeyRequest<undefined, AddResultRequest>,
): Promise<AddResultResponse> {
  const uid = req.ctx.decodedToken.uid;
  const response = await atomicUser(
    uid,
    async () => await addResultAtomic(req),
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
        req.body.result.language,
        req.body.result.mode,
        req.body.result.mode2,
        req.ctx.configuration.dailyLeaderboards,
        -1,
        req.body.result.client,
      );
      const entry = await daily?.getRank(
        uid,
        req.ctx.configuration.dailyLeaderboards,
      );
      if (entry) response.data.dailyLeaderboardRank = entry.rank;
      else delete response.data.dailyLeaderboardRank;
    })(),
    (async () => {
      if (response.data.weeklyXpLeaderboardRank === undefined) return;
      const weekly = WeeklyXpLeaderboard.get(
        req.ctx.configuration.leaderboards.weeklyXp,
        undefined,
        req.body.result.client,
      );
      const entry = await weekly?.getRank(
        uid,
        req.ctx.configuration.leaderboards.weeklyXp,
      );
      if (entry) response.data.weeklyXpLeaderboardRank = entry.rank;
      else delete response.data.weeklyXpLeaderboardRank;
    })(),
  ]);
  return response;
}

async function addResultAtomic(
  req: MonkeyRequest<undefined, AddResultRequest>,
): Promise<AddResultResponse | MonkeyError> {
  const validated = await validateSubmission(req);
  if (validated instanceof MonkeyError) return validated;
  return await applyProgression(validated);
}
