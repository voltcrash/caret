import { describe, expect, it } from "vite-plus/test";
import { createTestRuntime } from "./helpers";

describe("Discord removal migration", () => {
  it("cleans legacy identities and bot deliveries, preserving owners, rankings and rewards", async () => {
    const legacy = JSON.stringify({
      uid: "owner",
      name: "Owner",
      xp: 50,
      discordId: "discord-owner",
      discordAvatar: "avatar",
    });
    const rankings = [
      "leaderboard_bests",
      "leaderboard_snapshots",
      "daily_entries",
      "weekly_entries",
    ];
    // Delivery tables are dropped later by 0014; capture them just before.
    let deliveries: Record<string, unknown> = {};
    const test = await createTestRuntime({
      beforeMigration: async (db, file) => {
        if (file === "0014_remove_inbox.sql") {
          deliveries = {
            outbox: await db.prepare("SELECT id FROM outbox").first("id"),
            inbox: await db
              .prepare("SELECT count(*) AS count FROM inbox")
              .first("count"),
            scheduled_jobs: await db
              .prepare("SELECT count(*) AS count FROM scheduled_jobs")
              .first("count"),
          };
          return;
        }
        if (file !== "0002_remove_discord.sql") return;
        await db.batch([
          db
            .prepare(
              "INSERT INTO users(uid,id,name,name_key,email,discord_id,added_at,data) VALUES('owner','owner','Owner','owner','owner@example.com','discord-owner',0,?)",
            )
            .bind(legacy),
          db.prepare(
            "INSERT INTO auth_users(id,name,email,created_at,updated_at) VALUES('owner','Owner','owner@example.com',0,0)",
          ),
          db.prepare(
            "INSERT INTO auth_sessions(id,token,user_id,expires_at,created_at,updated_at) VALUES('session','token','owner',9999999999999,0,0)",
          ),
          db.prepare(
            "INSERT INTO oauth_states(uid,token,expires_at) VALUES('owner','discord-state',9999999999999)",
          ),
          db.prepare(
            "INSERT INTO blocklist(kind,hash,timestamp) VALUES('discordId','discord-hash',0),('email','email-hash',0)",
          ),
          db
            .prepare(
              "INSERT INTO leaderboard_bests(uid,board,wpm,acc,timestamp,data) VALUES('owner','time:15:english',100,100,0,?)",
            )
            .bind(legacy),
          db
            .prepare(
              "INSERT INTO leaderboard_snapshots(uid,board,generation,rank,data) VALUES('owner','time:15:english','generation',1,?)",
            )
            .bind(legacy),
          db
            .prepare(
              "INSERT INTO daily_entries(uid,board,period,score,expires_at,data) VALUES('owner','time:15:english',0,100,9999999999999,?)",
            )
            .bind(legacy),
          db
            .prepare(
              "INSERT INTO weekly_entries(uid,period,xp,time_typed_seconds,expires_at,data) VALUES('owner',0,50,10,9999999999999,?)",
            )
            .bind(legacy),
          db.prepare(
            "INSERT INTO outbox(id,type,created_at,data) VALUES('bot','george-tasks',0,'{}'),('reward','reward',0,'{}')",
          ),
          db.prepare(
            "INSERT INTO scheduled_jobs(id,type,due_at,data) VALUES('payout','daily-leaderboard-results',0,'{}')",
          ),
          db.prepare(
            "INSERT INTO inbox(id,uid,timestamp,data) VALUES('mail','owner',0,'{}')",
          ),
          db
            .prepare("INSERT INTO configuration(id,data) VALUES('main',?)")
            .bind(
              JSON.stringify({
                users: { signUp: true, discordIntegration: { enabled: true } },
                dailyLeaderboards: { enabled: true, topResultsToAnnounce: 10 },
              }),
            ),
          db
            .prepare(
              "INSERT INTO configs(uid,id,data) VALUES('owner','config',?)",
            )
            .bind(JSON.stringify({ theme: "serika", showDiscordDot: true })),
          db
            .prepare(
              "INSERT INTO presets(uid,id,timestamp,data) VALUES('owner','preset',0,?)",
            )
            .bind(
              JSON.stringify({
                name: "Preset",
                config: { theme: "serika", showDiscordDot: true },
              }),
            ),
        ]);
      },
    });
    try {
      for (const table of ["users", ...rankings]) {
        const data = await test.env.DB.prepare(
          `SELECT data FROM ${table} WHERE uid='owner'`,
        ).first<string>("data");
        expect(JSON.parse(data ?? "null")).toEqual({
          uid: "owner",
          name: "Owner",
          xp: 50,
        });
      }
      const columns = await test.env.DB.prepare(
        "PRAGMA table_info(users)",
      ).all<{ name: string }>();
      expect(columns.results.map((column) => column.name)).not.toContain(
        "discord_id",
      );
      expect(
        await test.env.DB.prepare(
          "SELECT count(*) AS count FROM sqlite_master WHERE name='oauth_states'",
        ).first("count"),
      ).toBe(0);
      expect(
        await test.env.DB.prepare("SELECT kind FROM blocklist").first("kind"),
      ).toBe("email");
      expect(deliveries).toEqual({
        outbox: "reward",
        inbox: 1,
        scheduled_jobs: 1,
      });
      for (const table of ["auth_users", "auth_sessions"]) {
        expect(
          await test.env.DB.prepare(
            `SELECT count(*) AS count FROM ${table}`,
          ).first("count"),
        ).toBe(1);
      }
      const config = await test.env.DB.prepare(
        "SELECT data FROM configuration",
      ).first<string>("data");
      expect(JSON.parse(config ?? "null")).toEqual({
        users: { signUp: true },
        dailyLeaderboards: { enabled: true },
      });
      const settings = await test.env.DB.prepare(
        "SELECT data FROM configs",
      ).first<string>("data");
      expect(JSON.parse(settings ?? "null")).toEqual({ theme: "serika" });
      const preset = await test.env.DB.prepare(
        "SELECT data FROM presets",
      ).first<string>("data");
      expect(JSON.parse(preset ?? "null")).toEqual({
        name: "Preset",
        config: { theme: "serika" },
      });
      expect(
        (await test.env.DB.prepare("PRAGMA foreign_key_check").all()).results,
      ).toHaveLength(0);
    } finally {
      await test.dispose();
    }
  });
});
