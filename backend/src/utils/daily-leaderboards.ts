import LaterQueue from "../queues/later-queue";
import { matchesAPattern, kogascore, omit } from "./misc";
import type {
  Configuration,
  ValidModeRule,
} from "@oxytype/schemas/configuration";
import type {
  LeaderboardEntry,
  DailyLeaderboardEntry,
} from "@oxytype/schemas/leaderboards";
import type { Client, Mode, Mode2 } from "@oxytype/schemas/shared";
import { getCurrentDayTimestamp } from "@oxytype/util/date-and-time";
import { statement, encode } from "../db/client";
import { stage } from "../db/mutation";
import { rankingPage, rankingUser, type RankingRow } from "../db/ranking";
function unpack(row: RankingRow): LeaderboardEntry {
  return {
    ...(JSON.parse(row.data) as DailyLeaderboardEntry),
    rank: row.rank,
  };
}
export class DailyLeaderboard {
  private readonly modeRule: ValidModeRule;
  private readonly customTime: number;
  private readonly client: Client;
  private readonly board: string;
  constructor(
    modeRule: ValidModeRule,
    customTime = -1,
    client: Client = "web",
  ) {
    this.modeRule = modeRule;
    this.customTime = customTime;
    this.client = client;
    this.board = `${modeRule.language}:${modeRule.mode}:${modeRule.mode2}`;
  }
  private period(): number {
    return this.customTime === -1 ? getCurrentDayTimestamp() : this.customTime;
  }
  public async addResult(
    entry: DailyLeaderboardEntry,
    config: Configuration["dailyLeaderboards"],
  ): Promise<number> {
    if (!config.enabled) return -1;
    const period = this.period(),
      score = kogascore(entry.wpm, entry.acc, entry.timestamp);
    // Both reads are independent of this entry's writes; run them together.
    const [previous, ahead] = await Promise.all([
      statement(
        "SELECT score FROM daily_entries WHERE board=? AND period=? AND uid=?",
        this.board,
        period,
        entry.uid,
      ).first<number>("score"),
      statement(
        "SELECT count(*) AS count FROM daily_entries WHERE board=? AND period=? AND uid<>? AND (score>? OR (score=? AND uid>?))",
        this.board,
        period,
        entry.uid,
        score,
        score,
        entry.uid,
      ).first<number>("count"),
    ]);
    await stage(
      statement(
        "INSERT INTO daily_entries(board,period,uid,score,expires_at,data) VALUES(?,?,?,?,?,?) ON CONFLICT(board,period,uid) DO UPDATE SET score=excluded.score,data=excluded.data WHERE excluded.score>daily_entries.score",
        this.board,
        period,
        entry.uid,
        score,
        period + config.leaderboardExpirationTimeInDays * 86400000,
        encode(entry),
      ),
    );
    await stage(
      statement(
        "DELETE FROM daily_entries WHERE board=? AND period=? AND uid NOT IN (SELECT uid FROM daily_entries WHERE board=? AND period=? ORDER BY score DESC,uid DESC LIMIT ?)",
        this.board,
        period,
        this.board,
        period,
        config.maxResults,
      ),
    );
    if (isValidModeRule(this.modeRule, config.scheduleRewardsModeRules)) {
      await LaterQueue.scheduleForTomorrow(
        "daily-leaderboard-results",
        this.board,
        this.modeRule,
        this.client,
      );
    }
    if (previous !== null && previous >= score) return -1;
    const rank = (ahead ?? 0) + 1;
    return rank > config.maxResults ? -1 : rank;
  }
  public async getResults(
    page: number,
    pageSize: number,
    config: Configuration["dailyLeaderboards"],
    premium: boolean,
    includeExpired = false,
  ): Promise<{
    entries: LeaderboardEntry[];
    count: number;
    minWpm: number;
  } | null> {
    if (!config.enabled) return null;
    const result = await rankingPage(
      "daily_entries",
      this.period(),
      page,
      pageSize,
      this.board,
      includeExpired,
    );
    return {
      entries: result.rows
        .map(unpack)
        .map((entry) => (premium ? entry : omit(entry, ["isPremium"]))),
      count: result.count,
      minWpm: result.minWpm,
    };
  }
  public async getRank(
    uid: string,
    config: Configuration["dailyLeaderboards"],
  ): Promise<LeaderboardEntry | null> {
    if (!config.enabled) return null;
    const row = await rankingUser(
      "daily_entries",
      this.period(),
      uid,
      this.board,
    );
    return row ? unpack(row) : null;
  }
}
export async function purgeUserFromDailyLeaderboards(
  uid: string,
  _config: Configuration["dailyLeaderboards"],
  _client?: Client,
): Promise<void> {
  await stage(statement("DELETE FROM daily_entries WHERE uid=?", uid));
}
function isValidModeRule(
  modeRule: ValidModeRule,
  modeRules: ValidModeRule[],
): boolean {
  const { language, mode, mode2 } = modeRule;

  return modeRules.some((rule) => {
    const matchesLanguage = matchesAPattern(language, rule.language);
    const matchesMode = matchesAPattern(mode, rule.mode);
    const matchesMode2 = matchesAPattern(mode2, rule.mode2);
    return matchesLanguage && matchesMode && matchesMode2;
  });
}

export function getDailyLeaderboard(
  language: string,
  mode: Mode,
  mode2: Mode2<Mode>,
  dailyLeaderboardsConfig: Configuration["dailyLeaderboards"],
  customTimestamp = -1,
  client: Client = "web",
): DailyLeaderboard | null {
  const { validModeRules, enabled } = dailyLeaderboardsConfig;

  const modeRule: ValidModeRule = { language, mode, mode2 };
  const isValidMode = isValidModeRule(modeRule, validModeRules);

  if (!enabled || !isValidMode) {
    return null;
  }

  return new DailyLeaderboard(modeRule, customTimestamp, client);
}
