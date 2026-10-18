import type { Client } from "@oxytype/schemas/shared";
import type { Configuration } from "@oxytype/schemas/configuration";
import type {
  XpLeaderboardProfile,
  XpLeaderboardScore,
  XpLeaderboardEntry,
} from "@oxytype/schemas/leaderboards";
import LaterQueue from "../queues/later-queue";
import { getCurrentWeekTimestamp } from "@oxytype/util/date-and-time";
import { statement, encode } from "../db/client";
import { stage } from "../db/mutation";
import { rankingPage, rankingUser, type RankingRow } from "../db/ranking";
import { omit } from "../utils/misc";
export type AddResultOpts = {
  entry: XpLeaderboardProfile;
  xpGained: XpLeaderboardScore;
};
function unpack(row: RankingRow): XpLeaderboardEntry {
  return {
    ...(JSON.parse(row.data) as XpLeaderboardProfile),
    rank: row.rank,
    totalXp: row.score,
    timeTypedSeconds: row.timeTypedSeconds ?? 0,
  };
}
export class WeeklyXpLeaderboard {
  private readonly customTime: number;
  private readonly client: Client;
  constructor(customTime = -1, client: Client = "web") {
    this.customTime = customTime;
    this.client = client;
  }
  private period(): number {
    return this.customTime === -1 ? getCurrentWeekTimestamp() : this.customTime;
  }
  public async addResult(
    config: Configuration["leaderboards"]["weeklyXp"],
    opts: AddResultOpts,
  ): Promise<number> {
    if (!config.enabled) return -1;
    const { entry, xpGained } = opts,
      period = this.period();
    // Rank against this user's total after the gain, in a single read.
    const ahead = await statement(
      "WITH me AS (SELECT COALESCE((SELECT xp FROM weekly_entries WHERE client=? AND period=? AND uid=?),0)+? AS xp) SELECT count(*) AS count FROM weekly_entries,me WHERE client=? AND period=? AND uid<>? AND (weekly_entries.xp>me.xp OR (weekly_entries.xp=me.xp AND uid>?))",
      this.client,
      period,
      entry.uid,
      xpGained,
      this.client,
      period,
      entry.uid,
      entry.uid,
    ).first<number>("count");
    await stage(
      statement(
        "INSERT INTO weekly_entries(client,period,uid,xp,time_typed_seconds,expires_at,data) VALUES(?,?,?,?,?,?,?) ON CONFLICT(client,period,uid) DO UPDATE SET xp=xp+excluded.xp,time_typed_seconds=time_typed_seconds+excluded.time_typed_seconds,data=excluded.data",
        this.client,
        period,
        entry.uid,
        xpGained,
        entry.timeTypedSeconds,
        period + config.expirationTimeInDays * 86400000,
        encode(entry),
      ),
    );
    await LaterQueue.scheduleForNextWeek(
      "weekly-xp-leaderboard-results",
      "weekly",
      this.client,
    );
    return (ahead ?? 0) + 1;
  }
  public async getResults(
    page: number,
    pageSize: number,
    config: Configuration["leaderboards"]["weeklyXp"],
    premium: boolean,
    includeExpired = false,
  ): Promise<{ entries: XpLeaderboardEntry[]; count: number } | null> {
    if (!config.enabled) return null;
    const result = await rankingPage(
      "weekly_entries",
      this.period(),
      page,
      pageSize,
      undefined,
      includeExpired,
      this.client,
    );
    return {
      entries: result.rows
        .map(unpack)
        .map((entry) => (premium ? entry : omit(entry, ["isPremium"]))),
      count: result.count,
    };
  }
  public async getRank(
    uid: string,
    config: Configuration["leaderboards"]["weeklyXp"],
  ): Promise<XpLeaderboardEntry | null> {
    if (!config.enabled) return null;
    const row = await rankingUser(
      "weekly_entries",
      this.period(),
      uid,
      undefined,
      this.client,
    );
    return row ? unpack(row) : null;
  }
}
export function get(
  weeklyXpLeaderboardConfig: Configuration["leaderboards"]["weeklyXp"],
  customTimestamp?: number,
  client: Client = "web",
): WeeklyXpLeaderboard | null {
  const { enabled } = weeklyXpLeaderboardConfig;

  if (!enabled) {
    return null;
  }

  return new WeeklyXpLeaderboard(customTimestamp, client);
}

export async function purgeUserFromXpLeaderboards(
  uid: string,
  _config: Configuration["leaderboards"]["weeklyXp"],
): Promise<void> {
  await stage(statement("DELETE FROM weekly_entries WHERE uid=?", uid));
}
