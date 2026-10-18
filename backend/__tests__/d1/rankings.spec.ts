import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";
import { withRuntime } from "../../src/runtime/env";
import { DailyLeaderboard } from "../../src/utils/daily-leaderboards";
import { WeeklyXpLeaderboard } from "../../src/services/weekly-xp-leaderboard";
import { BASE_CONFIGURATION } from "../../src/constants/base-configuration";
import { statement } from "../../src/db/client";
import { atomicUser } from "../../src/db/mutation";
import * as Leaderboards from "../../src/dal/leaderboards";

describe("SQL ranking parity", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime();
    for (const uid of ["a", "b", "c"]) await seedUser(test.env, uid);
  });
  afterAll(async () => {
    await test?.dispose();
  });
  it("keeps best daily scores, top N, reverse lexical ties, and global ranks", async () => {
    await withRuntime(test.env, async () => {
      const board = new DailyLeaderboard({
        language: "english",
        mode: "time",
        mode2: "15",
      });
      const config = {
        ...BASE_CONFIGURATION.dailyLeaderboards,
        enabled: true,
        maxResults: 2,
        leaderboardExpirationTimeInDays: 7,
      };
      const timestamp = Date.now();
      const entry = {
        name: "A",
        uid: "a",
        wpm: 100,
        raw: 100,
        acc: 100,
        consistency: 100,
        timestamp,
      };
      await atomicUser("a", async () => {
        expect(await board.addResult(entry, config)).toBe(1);
      });
      expect(await board.addResult({ ...entry, uid: "b" }, config)).toBe(1);
      expect(await board.addResult({ ...entry, wpm: 90 }, config)).toBe(-1);
      expect(
        await board.addResult({ ...entry, uid: "c", wpm: 80 }, config),
      ).toBe(-1);
      const results = await board.getResults(0, 10, config, false);
      expect(results?.entries.map((row) => row.uid)).toEqual(["b", "a"]);
      expect(await board.getRank("a", config)).toMatchObject({
        uid: "a",
        rank: 2,
        wpm: 100,
      });
    });
  });
  it("increments weekly XP and time atomically", async () => {
    await withRuntime(test.env, async () => {
      const board = new WeeklyXpLeaderboard();
      const config = {
        ...BASE_CONFIGURATION.leaderboards.weeklyXp,
        enabled: true,
        expirationTimeInDays: 14,
      };
      const entry = {
        uid: "a",
        name: "A",
        lastActivityTimestamp: Date.now(),
        timeTypedSeconds: 10,
      };
      await Promise.all([
        board.addResult(config, { entry, xpGained: 10 }),
        board.addResult(config, { entry, xpGained: 20 }),
      ]);
      expect(await board.getRank("a", config)).toMatchObject({
        totalXp: 30,
        timeTypedSeconds: 20,
        rank: 1,
      });
    });
  });
  it("ranks weekly XP gains against the updated total", async () => {
    await withRuntime(test.env, async () => {
      const board = new WeeklyXpLeaderboard(Date.UTC(2020, 0, 6));
      const config = {
        ...BASE_CONFIGURATION.leaderboards.weeklyXp,
        enabled: true,
        expirationTimeInDays: 14,
      };
      const entry = (
        uid: string,
      ): {
        uid: string;
        name: string;
        lastActivityTimestamp: number;
        timeTypedSeconds: number;
      } => ({
        uid,
        name: uid,
        lastActivityTimestamp: Date.now(),
        timeTypedSeconds: 10,
      });
      expect(
        await board.addResult(config, { entry: entry("b"), xpGained: 50 }),
      ).toBe(1);
      expect(
        await board.addResult(config, { entry: entry("a"), xpGained: 30 }),
      ).toBe(2);
      // 30 + 20 ties b at 50; reverse lexical order keeps b ahead
      expect(
        await board.addResult(config, { entry: entry("a"), xpGained: 20 }),
      ).toBe(2);
      await atomicUser("c", async () => {
        expect(
          await board.addResult(config, { entry: entry("c"), xpGained: 60 }),
        ).toBe(1);
      });
    });
  });
  it("publishes complete all-time generations and hides ineligible users", async () => {
    await withRuntime(test.env, async () => {
      await statement(
        "UPDATE users SET time_typing=100 WHERE uid IN ('a','b')",
      ).run();
      for (const uid of ["a", "b"]) {
        await statement(
          "INSERT INTO leaderboard_bests(uid,board,wpm,acc,timestamp,data) VALUES(?,'english_time_15',100,100,1,?)",
          uid,
          JSON.stringify({ wpm: 100, acc: 100, timestamp: 1, raw: 100 }),
        ).run();
      }
      await Leaderboards.update("time", "15", "english");
      expect(await Leaderboards.getCount("time", "15", "english")).toBe(2);
      expect(
        (await Leaderboards.get("time", "15", "english", 0, 10)).map(
          (row) => row.uid,
        ),
      ).toEqual(["b", "a"]);
      await statement("UPDATE users SET banned=1 WHERE uid='b'").run();
      await Leaderboards.update("time", "15", "english");
      expect(
        await Leaderboards.getRank("time", "15", "english", "b"),
      ).toBeNull();
      expect(
        await statement(
          "SELECT count(DISTINCT generation) AS count FROM leaderboard_snapshots",
        ).first<number>("count"),
      ).toBe(1);
    });
  });
});
