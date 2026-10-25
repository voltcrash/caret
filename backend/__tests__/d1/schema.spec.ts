import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";
import { withRuntime, envValue } from "../../src/runtime/env";

describe("D1 schema on workerd", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime();
  });
  afterAll(async () => {
    await test?.dispose();
  });

  it("creates auth, application and ranking tables without retired ones", async () => {
    const tables = await test.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'",
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
    const indexes = await test.env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='results' AND sql IS NOT NULL ORDER BY name",
    ).all<{ name: string }>();
    expect(indexes.results.map((row) => row.name)).toEqual([
      "results_client_time_idx",
      "results_submission_idx",
    ]);
  });
  it("removes a user's leaderboard bests through an index", async () => {
    for (const query of [
      "DELETE FROM users WHERE uid='owner'",
      "DELETE FROM leaderboard_bests WHERE uid='owner'",
    ]) {
      const plan = await test.env.DB.prepare(
        `EXPLAIN QUERY PLAN ${query}`,
      ).all<{
        detail: string;
      }>();
      const details = plan.results.map(({ detail }) => detail);
      expect(
        details.filter((detail) => detail.includes("leaderboard_bests")),
      ).toEqual([expect.stringContaining("leaderboard_bests_owner_idx")]);
    }
  });
  it("enforces normalized user names and cascades owned rows", async () => {
    await seedUser(test.env, "owner", "Name");
    await expect(seedUser(test.env, "other", "name")).rejects.toThrow(/UNIQUE/);
    await test.env.DB.prepare(
      "INSERT INTO configs (uid,id,data) VALUES (?,?,?)",
    )
      .bind("owner", "config", "{}")
      .run();
    await test.env.DB.prepare("DELETE FROM users WHERE uid=?")
      .bind("owner")
      .run();
    expect(
      await test.env.DB.prepare("SELECT count(*) AS count FROM configs").first(
        "count",
      ),
    ).toBe(0);
  });
  it("rolls back the entire batch when its version assertion fails", async () => {
    await expect(
      test.env.DB.batch([
        test.env.DB.prepare(
          "INSERT INTO public_stats (id) VALUES ('rollback')",
        ),
        test.env.DB.prepare(
          "INSERT INTO mutation_guards (id,valid) VALUES ('failed',0)",
        ),
      ]),
    ).rejects.toThrow(/mutation_version/);
    expect(
      await test.env.DB.prepare(
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
