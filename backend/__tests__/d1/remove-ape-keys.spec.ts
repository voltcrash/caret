import { describe, expect, it } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";

describe("API key removal migration", () => {
  it("deletes credentials and obsolete metadata while preserving accounts and unrelated records", async () => {
    const retained = {
      users: { signUp: true },
      results: { savingEnabled: true },
    };
    const retiredBuckets = [
      "apeKeysGet",
      "apeKeysGenerate",
      "defaultApeRateLimit",
      "resultsGetApe",
      "resultByIdGetApe",
    ];
    const test = await createTestRuntime({
      beforeMigration: async (db, file) => {
        if (file !== "0015_remove_ape_keys.sql") return;
        await seedUser({ DB: db }, "legacy");
        await seedUser({ DB: db }, "clean");
        await db.batch([
          db.prepare(
            "UPDATE users SET data=json_set(data,'$.canManageApeKeys',json('false'),'$.xp',123),version=4 WHERE uid='legacy'",
          ),
          db.prepare(
            "INSERT INTO ape_keys(id,uid,name,enabled,hash,created_on,modified_on,last_used_on,use_count) VALUES('retired','legacy','key',1,'sha256:fixture',0,0,-1,0)",
          ),
          db.prepare(
            "INSERT INTO auth_users(id,name,email,created_at,updated_at) VALUES('legacy','Legacy','legacy@example.test',0,0)",
          ),
          db.prepare(
            "INSERT INTO auth_sessions(id,token,user_id,expires_at,created_at,updated_at) VALUES('session','fixture-token','legacy',9999999999999,0,0)",
          ),
          db.prepare(
            "INSERT INTO auth_device_codes(id,device_code,user_code,user_id,expires_at,status) VALUES('device','device-fixture','user-fixture','legacy',9999999999999,'pending')",
          ),
          db.prepare(
            "INSERT INTO client_profiles(uid,client,time_typing,data) VALUES('legacy','web',12,'{}')",
          ),
          db.prepare(
            "INSERT INTO results(id,uid,timestamp,mode,mode2,language,wpm,acc,data) VALUES('result','legacy',1,'time','15','english',80,100,'{}')",
          ),
          db
            .prepare(
              "INSERT INTO configuration(id,version,data) VALUES('legacy',7,?)",
            )
            .bind(
              JSON.stringify({
                ...retained,
                apeKeys: { acceptKeys: true, endpointsEnabled: true },
              }),
            ),
          db
            .prepare(
              "INSERT INTO configuration(id,version,data) VALUES('clean',3,?)",
            )
            .bind(JSON.stringify(retained)),
          ...[...retiredBuckets, "resultsGet", "resultsGetApeSuffix"].map(
            (id) =>
              db
                .prepare(
                  "INSERT INTO rate_counters(key,points,expires_at) VALUES(?,1,9999999999999)",
                )
                .bind(`rate:${id}:legacy`),
          ),
        ]);
      },
    });
    try {
      const tables = await test.env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type='table'",
      ).all<{ name: string }>();
      expect(tables.results.map(({ name }) => name)).not.toContain("ape_keys");
      const configurations = await test.env.DB.prepare(
        "SELECT id,version,data FROM configuration ORDER BY id",
      ).all<{ id: string; version: number; data: string }>();
      expect(
        configurations.results.map((row) => ({
          ...row,
          data: JSON.parse(row.data),
        })),
      ).toEqual([
        { id: "clean", version: 3, data: retained },
        { id: "legacy", version: 8, data: retained },
      ]);
      const user = await test.env.DB.prepare(
        "SELECT version,data FROM users WHERE uid='legacy'",
      ).first<{ version: number; data: string }>();
      expect(user?.version).toBe(5);
      expect(JSON.parse(user?.data ?? "null")).toMatchObject({
        uid: "legacy",
        name: "legacy",
        xp: 123,
      });
      expect(JSON.parse(user?.data ?? "null")).not.toHaveProperty(
        "canManageApeKeys",
      );
      expect(
        await test.env.DB.prepare(
          "SELECT version FROM users WHERE uid='clean'",
        ).first("version"),
      ).toBe(0);
      for (const table of [
        "auth_users",
        "auth_sessions",
        "auth_device_codes",
        "client_profiles",
        "results",
      ]) {
        expect(
          await test.env.DB.prepare(
            `SELECT count(*) AS count FROM ${table}`,
          ).first("count"),
        ).toBe(1);
      }
      const counters = await test.env.DB.prepare(
        "SELECT key FROM rate_counters ORDER BY key",
      ).all<{ key: string }>();
      expect(counters.results.map(({ key }) => key)).toEqual([
        "rate:resultsGet:legacy",
        "rate:resultsGetApeSuffix:legacy",
      ]);
      expect(
        (await test.env.DB.prepare("PRAGMA foreign_key_check").all()).results,
      ).toHaveLength(0);
    } finally {
      await test.dispose();
    }
  });
});
