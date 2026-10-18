import { describe, expect, it } from "vite-plus/test";
import { createTestRuntime } from "./helpers";
import { getLiveConfiguration } from "../../src/init/configuration";
import { withRuntime } from "../../src/runtime/env";

const inertXp = {
  enabled: false,
  funboxBonus: 0,
  gainMultiplier: 0,
  maxDailyBonus: 0,
  minDailyBonus: 0,
  streak: { enabled: false, maxStreakDays: 0, maxStreakMultiplier: 0 },
};
const inertWeeklyXp = {
  enabled: false,
  expirationTimeInDays: 0,
  xpRewardBrackets: [],
};

describe("XP enable migration", () => {
  it("enables xp left at the old inert defaults and keeps admin choices", async () => {
    const customised = {
      users: { xp: { ...inertXp, gainMultiplier: 2 } },
      leaderboards: {
        weeklyXp: { ...inertWeeklyXp, expirationTimeInDays: 30 },
      },
    };
    const test = await createTestRuntime({
      beforeMigration: async (db, file) => {
        if (file !== "0003_enable_xp.sql") return;
        await db.batch([
          db
            .prepare("INSERT INTO configuration(id,data) VALUES('main',?)")
            .bind(
              JSON.stringify({
                users: { signUp: true, xp: inertXp },
                leaderboards: { minTimeTyping: 7200, weeklyXp: inertWeeklyXp },
              }),
            ),
          db
            .prepare("INSERT INTO configuration(id,data) VALUES('custom',?)")
            .bind(JSON.stringify(customised)),
        ]);
      },
    });
    try {
      const rows = await test.env.DB.prepare(
        "SELECT id,version,data FROM configuration ORDER BY id",
      ).all<{ id: string; version: number; data: string }>();
      const [custom, main] = rows.results;
      // 0014 later strips the retired weekly reward brackets.
      const { xpRewardBrackets: _brackets, ...weeklyXp } =
        customised.leaderboards.weeklyXp;
      expect(custom?.version).toBe(1);
      expect(JSON.parse(custom?.data ?? "null")).toEqual({
        ...customised,
        leaderboards: { weeklyXp },
      });
      expect(main?.version).toBe(3);
      expect(JSON.parse(main?.data ?? "null")).toEqual({
        users: {
          signUp: true,
          xp: {
            enabled: true,
            funboxBonus: 0.1,
            gainMultiplier: 1,
            maxDailyBonus: 1000,
            minDailyBonus: 100,
            streak: {
              enabled: true,
              maxStreakDays: 100,
              maxStreakMultiplier: 2,
            },
          },
        },
        leaderboards: {
          minTimeTyping: 7200,
          weeklyXp: {
            enabled: true,
            expirationTimeInDays: 15,
          },
        },
      });
    } finally {
      await test.dispose();
    }
  });

  it("awards xp on a fresh configuration", async () => {
    const test = await createTestRuntime();
    try {
      const configuration = await withRuntime(test.env, getLiveConfiguration);
      expect(configuration.users.xp.enabled).toBe(true);
      expect(configuration.users.xp.gainMultiplier).toBe(1);
      expect(configuration.leaderboards.weeklyXp.enabled).toBe(true);
      expect(
        configuration.leaderboards.weeklyXp.expirationTimeInDays,
      ).toBeGreaterThanOrEqual(15);
    } finally {
      await test.dispose();
    }
  });
});
