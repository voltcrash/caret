import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";
import { withRuntime, envValue } from "../../src/runtime/env";

describe("PostgreSQL schema on workerd", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime();
  });
  afterAll(async () => {
    await test?.dispose();
  });

  it("creates auth, application and ranking tables without retired ones", async () => {
    const tables = await test.db.prepare(
      "SELECT tablename AS name FROM pg_tables WHERE schemaname='public'",
    ).all<{ name: string }>();
    expect(tables.results.map((row) => row.name)).toEqual(
      expect.arrayContaining([
        "auth_users",
        "auth_accounts",
        "auth_sessions",
        "auth_verifications",
        "users",
        "results",
        "daily_entries",
        "weekly_entries",
      ]),
    );
    for (const removed of [
      "ape_keys",
      "connections",
      "inbox",
      "reward_grants",
      "scheduled_jobs",
      "outbox",
      "rate_counters",
      "auth_rate_limits",
    ]) {
      expect(tables.results.map((row) => row.name)).not.toContain(removed);
    }
  });
  it("keeps only the result indexes production queries use", async () => {
    const indexes = await test.db.prepare(
      "SELECT indexname AS name FROM pg_indexes WHERE tablename='results' AND indexname<>'results_pkey' ORDER BY name",
    ).all<{ name: string }>();
    expect(indexes.results.map((row) => row.name)).toEqual([
      "results_client_time_idx",
      "results_submission_idx",
    ]);
  });
  it("enforces normalized user names and cascades owned rows", async () => {
    await seedUser(test.env, "owner", "Name");
    await expect(seedUser(test.env, "other", "name")).rejects.toThrow(/unique constraint/);
    await test.db.prepare(
      "INSERT INTO configs (uid,id,data) VALUES (?,?,?)",
    )
      .bind("owner", "config", "{}")
      .run();
    await test.db.prepare("DELETE FROM users WHERE uid=?")
      .bind("owner")
      .run();
    expect(
      await test.db.prepare("SELECT count(*) AS count FROM configs").first(
        "count",
      ),
    ).toBe(0);
  });
  it("rolls back the entire batch when its version assertion fails", async () => {
    await expect(
      test.db.batch([
        test.db.prepare(
          "INSERT INTO public_stats (id) VALUES ('rollback')",
        ),
        test.db.prepare(
          "INSERT INTO mutation_guards (id,valid) VALUES ('failed',0)",
        ),
      ]),
    ).rejects.toThrow(/mutation_version/);
    expect(
      await test.db.prepare(
        "SELECT id FROM public_stats WHERE id='rollback'",
      ).first(),
    ).toBeNull();
  });
  it("isolates environment bindings across concurrent invocations", async () => {
    const read = async (name: string): Promise<string | undefined> =>
      await withRuntime({ ...test.env, VERSION: name }, async () => {
        await Promise.resolve();
        return envValue("VERSION");
      });
    expect(await Promise.all([read("one"), read("two")])).toEqual([
      "one",
      "two",
    ]);
  });
});
