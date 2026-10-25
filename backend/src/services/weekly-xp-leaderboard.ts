import type { Client } from "@oxytype/schemas/shared";
import type { Configuration } from "@oxytype/schemas/configuration";
import type {
  XpLeaderboardProfile,
  XpLeaderboardScore,
  XpLeaderboardEntry,
} from "@oxytype/schemas/leaderboards";
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
  /**
   * Stage this gain; resolves false when the board is disabled. Callers read
   * the committed rank afterwards with `getRank`.
   */
  public async addResult(
    config: Configuration["leaderboards"]["weeklyXp"],
    opts: AddResultOpts,
  ): Promise<boolean> {
    if (!config.enabled) return false;
    const { entry, xpGained } = opts,
      period = this.period();
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
    return true;
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
