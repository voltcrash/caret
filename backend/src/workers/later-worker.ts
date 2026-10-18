import Logger from "../utils/logger";
import { statement, encode, binding } from "../db/client";
import { createHash } from "node:crypto";
import type { Configuration } from "@oxytype/schemas/configuration";
import { buildMonkeyMail } from "../utils/monkey-mail";
import { DailyLeaderboard } from "../utils/daily-leaderboards";
import { getCachedConfiguration } from "../init/configuration";
import { formatSeconds, getOrdinalNumberString } from "../utils/misc";
import LaterQueue, {
  type LaterTask,
  type LaterTaskContexts,
  type LaterTaskType,
} from "../queues/later-queue";
import { WeeklyXpLeaderboard } from "../services/weekly-xp-leaderboard";
import { MonkeyMail } from "@oxytype/schemas/users";
import { isSafeNumber, mapRange } from "@oxytype/util/numbers";
import { RewardBracket } from "@oxytype/schemas/configuration";

async function handleDailyLeaderboardResults(
  ctx: LaterTaskContexts["daily-leaderboard-results"],
): Promise<void> {
  if (ctx.client !== undefined && ctx.client !== "web") return;
  const { yesterdayTimestamp, modeRule } = ctx;
  const { language, mode, mode2 } = modeRule;
  const {
    dailyLeaderboards: dailyLeaderboardsConfig,
    users: { inbox: inboxConfig },
  } = await getCachedConfiguration(false);

  const { maxResults, xpRewardBrackets } = dailyLeaderboardsConfig;
  if (!inboxConfig.enabled || xpRewardBrackets.length === 0) return;

  const maxRankToGet = Math.max(
    ...xpRewardBrackets.map((bracket) => bracket.maxRank),
  );

  const dailyLeaderboard = new DailyLeaderboard(
    modeRule,
    yesterdayTimestamp,
    ctx.client,
  );

  const results = await dailyLeaderboard.getResults(
    Math.floor((ctx.offset ?? 0) / 20),
    20,
    dailyLeaderboardsConfig,
    false,
    true,
  );

  if (results === null || results.entries.length === 0) {
    return;
  }

  if (inboxConfig.enabled && xpRewardBrackets.length > 0) {
    const mailEntries: {
      uid: string;
      mail: MonkeyMail[];
    }[] = [];

    results.entries
      .filter((entry) => entry.rank <= maxRankToGet)
      .forEach((entry) => {
        const rank = entry.rank ?? maxResults;
        const wpm = Math.round(entry.wpm);

        const placementString = getOrdinalNumberString(rank);

        const xpReward = calculateXpReward(xpRewardBrackets, rank);

        if (!isSafeNumber(xpReward)) return;

        const rewardMail = buildMonkeyMail({
          subject: "Daily leaderboard placement",
          body: `Congratulations ${entry.name} on placing ${placementString} with ${wpm} wpm in the ${language} ${mode} ${mode2} daily leaderboard!`,
          rewards: [
            {
              type: "xp",
              item: Math.round(xpReward),
            },
          ],
        });

        rewardMail.id = rewardId(
          `daily:${yesterdayTimestamp}:${language}:${mode}:${mode2}:${entry.uid}`,
        );
        mailEntries.push({
          uid: entry.uid,
          mail: [rewardMail],
        });
      });

    await enqueueRewards(mailEntries, inboxConfig);
  }

  if ((ctx.offset ?? 0) + 20 < maxRankToGet) {
    await LaterQueue.add(
      "todo-tomorrow",
      {
        taskName: "daily-leaderboard-results",
        ctx: { ...ctx, offset: (ctx.offset ?? 0) + 20 },
      },
      {
        jobId: `daily:${yesterdayTimestamp}:${language}:${mode}:${mode2}:${(ctx.offset ?? 0) + 20}`,
        delay: 0,
      },
    );
  }
}

async function handleWeeklyXpLeaderboardResults(
  ctx: LaterTaskContexts["weekly-xp-leaderboard-results"],
): Promise<void> {
  const {
    leaderboards: { weeklyXp: weeklyXpConfig },
    users: { inbox: inboxConfig },
  } = await getCachedConfiguration(false);

  const { enabled, xpRewardBrackets } = weeklyXpConfig;
  if (!enabled || xpRewardBrackets.length === 0) {
    return;
  }

  if (ctx.client !== undefined && ctx.client !== "web") return;
  const { lastWeekTimestamp } = ctx;
  const weeklyXpLeaderboard = new WeeklyXpLeaderboard(
    lastWeekTimestamp,
    ctx.client,
  );

  const maxRankToGet = Math.max(
    ...xpRewardBrackets.map((bracket) => bracket.maxRank),
  );

  const allResults = await weeklyXpLeaderboard.getResults(
    Math.floor((ctx.offset ?? 0) / 20),
    20,
    weeklyXpConfig,
    false,
    true,
  );

  if (allResults === null || allResults.entries.length === 0) {
    return;
  }

  const mailEntries: {
    uid: string;
    mail: MonkeyMail[];
  }[] = [];

  allResults.entries
    .filter((entry) => entry.rank <= maxRankToGet)
    .forEach((entry) => {
      const { uid, name, rank, totalXp, timeTypedSeconds } = entry;

      const xp = Math.round(totalXp);
      const placementString = getOrdinalNumberString(rank);

      const xpReward = calculateXpReward(xpRewardBrackets, rank);

      if (!isSafeNumber(xpReward)) return;

      const rewardMail = buildMonkeyMail({
        subject: "Weekly XP Leaderboard placement",
        body: `Congratulations ${name} on placing ${placementString} with ${xp} xp! Last week, you typed for a total of ${formatSeconds(
          timeTypedSeconds,
        )}! Keep up the good work :)`,
        rewards: [
          {
            type: "xp",
            item: Math.round(xpReward),
          },
        ],
      });

      rewardMail.id = rewardId(`weekly:${lastWeekTimestamp}:${uid}`);
      mailEntries.push({
        uid: uid,
        mail: [rewardMail],
      });
    });

  await enqueueRewards(mailEntries, inboxConfig);
  if ((ctx.offset ?? 0) + 20 < maxRankToGet) {
    await LaterQueue.add(
      "todo-next-week",
      {
        taskName: "weekly-xp-leaderboard-results",
        ctx: { ...ctx, offset: (ctx.offset ?? 0) + 20 },
      },
      {
        jobId: `weekly:${lastWeekTimestamp}:${(ctx.offset ?? 0) + 20}`,
        delay: 0,
      },
    );
  }
}

export async function jobHandler(
  task: LaterTask<LaterTaskType>,
): Promise<void> {
  const { taskName, ctx } = task;

  Logger.info(`Starting job: ${taskName}`);

  const start = performance.now();

  if (taskName === "daily-leaderboard-results") {
    const taskCtx = ctx as LaterTaskContexts["daily-leaderboard-results"];
    await handleDailyLeaderboardResults(taskCtx);
  } else if (taskName === "weekly-xp-leaderboard-results") {
    const taskCtx = ctx as LaterTaskContexts["weekly-xp-leaderboard-results"];
    await handleWeeklyXpLeaderboardResults(taskCtx);
  }

  const elapsed = performance.now() - start;
  Logger.success(`Job: ${taskName} - completed in ${elapsed}ms`);
}

function calculateXpReward(
  xpRewardBrackets: RewardBracket[],
  rank: number,
): number | undefined {
  const rewards = xpRewardBrackets
    .filter((bracket) => rank >= bracket.minRank && rank <= bracket.maxRank)
    .map((bracket) =>
      mapRange(
        rank,
        bracket.minRank,
        bracket.maxRank,
        bracket.maxReward,
        bracket.minReward,
      ),
    );
  return rewards.length ? Math.max(...rewards) : undefined;
}

function rewardId(origin: string): string {
  return createHash("sha256").update(origin).digest("hex").slice(0, 24);
}
async function enqueueRewards(
  entries: { uid: string; mail: MonkeyMail[] }[],
  inboxConfig: Configuration["users"]["inbox"],
): Promise<void> {
  if (!inboxConfig.enabled || entries.length === 0) return;
  await binding().batch(
    entries.map((entry) =>
      statement(
        "INSERT INTO outbox(id,type,uid,created_at,data) VALUES(?, 'reward',?,?,?) ON CONFLICT(id) DO NOTHING",
        `reward:${entry.mail[0]?.id ?? ""}`,
        entry.uid,
        Date.now(),
        encode({ ...entry, inboxConfig }),
      ),
    ),
  );
}

export const __testing = {
  calculateXpReward,
};
