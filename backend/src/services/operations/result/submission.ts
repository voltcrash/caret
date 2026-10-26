import { isUniqueViolation } from "../../../db/client";
import type { D1PreparedStatement } from "@cloudflare/workers-types";
import { atomicUserWithReads } from "../../../db/mutation";
import type { RankingRow } from "../../../db/ranking";

import MonkeyError from "../../../utils/error";

import MonkeyStatusCodes from "../../../constants/monkey-status-codes";
import { getDailyLeaderboard } from "../../../utils/daily-leaderboards";

import * as WeeklyXpLeaderboard from "../../../services/weekly-xp-leaderboard";

import {
  AddResultRequest,
  AddResultResponse,
} from "@caret/contracts/results";

import type { ServiceContext, OperationInput } from "../../context";

import { validateSubmission } from "./validation";
import { applyProgression } from "./progression";
type RankRead = {
  query: D1PreparedStatement;
  /** Apply the batched read's row. */
  apply: (row: RankingRow | null) => void;
  /** Read and apply the rank separately. */
  read: () => Promise<void>;
};

/**
 * Committed daily/weekly ranks for a saved result. Each replaces the
 * placeholder rank progression set, or removes it when there is no entry.
 */
function rankReads(
  context: ServiceContext,
  input: OperationInput<undefined, AddResultRequest>,
  response: AddResultResponse,
): RankRead[] {
  const uid = context.actor.uid;
  const { language, mode, mode2, client } = input.body.result;
  const reads: RankRead[] = [];
  if (response.data.dailyLeaderboardRank !== undefined) {
    const config = context.configuration.dailyLeaderboards;
    const daily = getDailyLeaderboard(
      language,
      mode,
      mode2,
      config,
      -1,
      client,
    );
    const query = daily?.rankStatement(uid, config) ?? null;
    if (daily && query) {
      const set = (entry: { rank: number } | null): void => {
        if (entry) response.data.dailyLeaderboardRank = entry.rank;
        else delete response.data.dailyLeaderboardRank;
      };
      reads.push({
        query,
        apply: (row) => {
          set(daily.rankFrom(row));
        },
        read: async () => {
          set(await daily.getRank(uid, config));
        },
      });
    } else {
      delete response.data.dailyLeaderboardRank;
    }
  }
  if (response.data.weeklyXpLeaderboardRank !== undefined) {
    const config = context.configuration.leaderboards.weeklyXp;
    const weekly = WeeklyXpLeaderboard.get(config, undefined, client);
    const query = weekly?.rankStatement(uid, config) ?? null;
    if (weekly && query) {
      const set = (entry: { rank: number } | null): void => {
        if (entry) response.data.weeklyXpLeaderboardRank = entry.rank;
        else delete response.data.weeklyXpLeaderboardRank;
      };
      reads.push({
        query,
        apply: (row) => {
          set(weekly.rankFrom(row));
        },
        read: async () => {
          set(await weekly.getRank(uid, config));
        },
      });
    } else {
      delete response.data.weeklyXpLeaderboardRank;
    }
  }
  return reads;
}

export async function addResult(
  context: ServiceContext,
  input: OperationInput<undefined, AddResultRequest>,
): Promise<AddResultResponse> {
  const uid = context.actor.uid;
  let ranks: RankRead[] = [];
  const { result: response, reads } = await atomicUserWithReads(
    uid,
    async () => await addResultAtomic(context, input),
    (outcome) => {
      ranks =
        outcome instanceof MonkeyError
          ? []
          : rankReads(context, input, outcome);
      // Ranks read in the committing batch see its writes: no extra trip.
      return ranks.map(({ query }) => query);
    },
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
  if (reads !== undefined) {
    ranks.forEach(({ apply }, index) => {
      apply((reads[index]?.results[0] as RankingRow | undefined) ?? null);
    });
  } else {
    // Recovered acknowledgement: read the committed ranks together.
    await Promise.all(ranks.map(async ({ read }) => await read()));
  }
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
