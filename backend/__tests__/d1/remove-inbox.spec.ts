import { describe, expect, it } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";

describe("inbox removal migration", () => {
  it("drops pending deliveries and removes only retired configuration fields", async () => {
    const retained = {
      users: { signUp: true, xp: { enabled: true } },
      dailyLeaderboards: {
        enabled: true,
        maxResults: 50,
        validModeRules: [{ language: "english", mode: "time", mode2: "15" }],
      },
      leaderboards: { weeklyXp: { enabled: true, expirationTimeInDays: 30 } },
    };
    const userData = { xp: 1234, inventory: { badges: [{ id: 14 }] } };
    const test = await createTestRuntime({
      beforeMigration: async (db, file) => {
        if (file !== "0014_remove_inbox.sql") return;
        await seedUser({ DB: db }, "owner");
        await db.batch([
          db
            .prepare("UPDATE users SET data=? WHERE uid='owner'")
            .bind(JSON.stringify(userData)),
          db.prepare(
            "INSERT INTO daily_entries(uid,board,period,score,expires_at,data) VALUES('owner','english_time_15',0,100,9999999999999,'{}')",
          ),
          db.prepare(
            "INSERT INTO weekly_entries(uid,period,xp,time_typed_seconds,expires_at,data) VALUES('owner',0,50,10,9999999999999,'{}')",
          ),
          db.prepare(
            "INSERT INTO inbox(id,uid,timestamp,data) VALUES('mail','owner',0,'{}')",
          ),
          db.prepare(
            "INSERT INTO reward_grants(id,uid,origin,data) VALUES('grant','owner','daily:0','{}')",
          ),
          db.prepare(
            "INSERT INTO outbox(id,type,created_at,data) VALUES('delivery','reward',0,'{}')",
          ),
          db.prepare(
            "INSERT INTO scheduled_jobs(id,type,due_at,data) VALUES('payout','daily-leaderboard-results',0,'{}')",
          ),
          db
            .prepare(
              "INSERT INTO configuration(id,version,data) VALUES('legacy',7,?)",
            )
            .bind(
              JSON.stringify({
                users: {
                  ...retained.users,
                  inbox: { enabled: true, maxMail: 10 },
                },
                dailyLeaderboards: {
                  ...retained.dailyLeaderboards,
                  scheduleRewardsModeRules:
                    retained.dailyLeaderboards.validModeRules,
                  xpRewardBrackets: [{ minRank: 1, maxRank: 1, xp: 100 }],
                },
                leaderboards: {
                  weeklyXp: {
                    ...retained.leaderboards.weeklyXp,
                    xpRewardBrackets: [{ minRank: 1, maxRank: 1, xp: 100 }],
                  },
                },
              }),
            ),
          db
            .prepare(
              "INSERT INTO configuration(id,version,data) VALUES('clean',3,?)",
            )
            .bind(JSON.stringify(retained)),
        ]);
      },
    });
    try {
      const rows = await test.env.DB.prepare(
        "SELECT id,version,data FROM configuration ORDER BY id",
      ).all<{ id: string; version: number; data: string }>();
      expect(
        rows.results.map((row) => ({ ...row, data: JSON.parse(row.data) })),
      ).toEqual([
        { id: "clean", version: 3, data: retained },
        { id: "legacy", version: 8, data: retained },
      ]);
      const tables = await test.env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table'",
      ).all<{ name: string }>();
      for (const name of [
        "inbox",
        "reward_grants",
        "outbox",
        "scheduled_jobs",
      ]) {
        expect(tables.results.map((row) => row.name)).not.toContain(name);
      }
      expect(
        JSON.parse(
          (await test.env.DB.prepare(
            "SELECT data FROM users WHERE uid='owner'",
          ).first<string>("data")) ?? "null",
        ),
      ).toEqual(userData);
      for (const name of ["daily_entries", "weekly_entries"]) {
        expect(
          await test.env.DB.prepare(
            `SELECT count(*) AS count FROM ${name}`,
          ).first("count"),
        ).toBe(1);
      }
      expect(
        (await test.env.DB.prepare("PRAGMA foreign_key_check").all()).results,
      ).toHaveLength(0);
    } finally {
      await test.dispose();
    }
  });
});
