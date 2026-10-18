import { describe, expect, it } from "vite-plus/test";
import { createTestRuntime } from "./helpers";
import { BASE_CONFIGURATION } from "../../src/constants/base-configuration";
import { getLiveConfiguration } from "../../src/init/configuration";
import { withRuntime } from "../../src/runtime/env";

const inertDailyLeaderboards = {
  enabled: false,
  maxResults: 0,
  leaderboardExpirationTimeInDays: 0,
  validModeRules: [],
  scheduleRewardsModeRules: [],
  xpRewardBrackets: [],
};

describe("daily leaderboards enable migration", () => {
  it("enables inert daily leaderboards, removes friendship configuration, and keeps admin choices", async () => {
    const disabled = {
      dailyLeaderboards: { ...inertDailyLeaderboards, maxResults: 50 },
    };
    const test = await createTestRuntime({
      beforeMigration: async (db, file) => {
        if (file !== "0005_enable_daily_leaderboards.sql") return;
        await db.batch([
          db
            .prepare("INSERT INTO configuration(id,data) VALUES('main',?)")
            .bind(
              JSON.stringify({
                users: { signUp: true },
                dailyLeaderboards: inertDailyLeaderboards,
                connections: { enabled: true, maxPerUser: 100 },
              }),
            ),
          db
            .prepare("INSERT INTO configuration(id,data) VALUES('custom',?)")
            .bind(
              JSON.stringify({
                ...disabled,
                connections: { enabled: false, maxPerUser: 50 },
              }),
            ),
          db
            .prepare("INSERT INTO configuration(id,data) VALUES('partial',?)")
            .bind(JSON.stringify({ users: { signUp: true } })),
        ]);
      },
    });
    try {
      const rows = await test.env.DB.prepare(
        "SELECT id,version,data FROM configuration ORDER BY id",
      ).all<{ id: string; version: number; data: string }>();
      const [custom, main, partial] = rows.results;
      // 0014 later strips the retired reward fields from every row.
      const {
        scheduleRewardsModeRules: _rules,
        xpRewardBrackets: _brackets,
        ...retained
      } = disabled.dailyLeaderboards;
      expect(custom?.version).toBe(2);
      expect(JSON.parse(custom?.data ?? "null")).toEqual({
        dailyLeaderboards: retained,
      });
      expect(partial?.version).toBe(0);
      expect(JSON.parse(partial?.data ?? "null")).toEqual({
        users: { signUp: true },
      });
      expect(main?.version).toBe(3);
      expect(JSON.parse(main?.data ?? "null")).toEqual({
        users: { signUp: true },
        dailyLeaderboards: BASE_CONFIGURATION.dailyLeaderboards,
      });
    } finally {
      await test.dispose();
    }
  });

  it("enables english time 15 and 60 daily leaderboards on a fresh configuration", async () => {
    const test = await createTestRuntime();
    try {
      const configuration = await withRuntime(test.env, getLiveConfiguration);
      expect(configuration.dailyLeaderboards.enabled).toBe(true);
      expect(configuration.dailyLeaderboards.maxResults).toBeGreaterThan(0);
      expect(
        configuration.dailyLeaderboards.leaderboardExpirationTimeInDays,
      ).toBeGreaterThanOrEqual(2);
      expect(configuration.dailyLeaderboards.validModeRules).toEqual([
        { language: "english", mode: "time", mode2: "(15|60)" },
      ]);
    } finally {
      await test.dispose();
    }
  });
});
