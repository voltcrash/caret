import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { ConfigurationSchema } from "@caret/schemas/configuration";
import { getLiveConfiguration } from "../../src/init/configuration";
import { withRuntime } from "../../src/runtime/env";
import { createTestRuntime, seedUser } from "./helpers";

describe("fresh production bootstrap on PostgreSQL", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  let sql: string;
  beforeEach(async () => {
    test = await createTestRuntime();
    sql = await readFile(
      resolve(__dirname, "../../bootstrap/production.sql"),
      "utf8",
    );
  });
  afterEach(async () => await test.dispose());

  it("enables core flows on an empty target without creating accounts", async () => {
    await test.db.prepare(sql).run();
    const configuration = await withRuntime(test.env, getLiveConfiguration);
    expect(ConfigurationSchema.safeParse(configuration).success).toBe(true);
    expect(configuration.users.signUp).toBe(true);
    expect(configuration.users.profiles.enabled).toBe(true);
    expect(configuration.results.savingEnabled).toBe(true);
    expect(configuration.results.objectHashCheckEnabled).toBe(true);
    expect(configuration.users.autoBan.enabled).toBe(false);
    expect(configuration.users.xp.enabled).toBe(true);
    expect(configuration.users.xp.gainMultiplier).toBe(1);
    expect(configuration.leaderboards.weeklyXp.enabled).toBe(true);
    expect(configuration.dailyLeaderboards.enabled).toBe(true);
    expect(configuration.quotes.submissionsEnabled).toBe(false);
    expect(configuration.admin.endpointsEnabled).toBe(false);
    const counts = await test.db
      .prepare(
        "SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM auth_users) AS auth, (SELECT count(*) FROM results) AS results",
      )
      .first();
    expect(counts).toEqual({
      users: 0,
      auth: 0,
      results: 0,
    });
  });

  it("refuses to replace existing configuration on a rerun", async () => {
    await test.db.prepare(sql).run();
    await test.db
      .prepare(
        "UPDATE configuration SET version=7,data=jsonb_set(data,'{users,signUp}','false'::jsonb) WHERE id='main'",
      )
      .run();
    const before = await test.db.prepare("SELECT * FROM configuration").first();
    await expect(test.db.prepare(sql).run()).rejects.toThrow(/null value/);
    expect(
      await test.db.prepare("SELECT * FROM configuration").first(),
    ).toEqual(before);
  });

  it("refuses a target containing an application user", async () => {
    await seedUser(test.env, "existing", "Existing");
    await expect(test.db.prepare(sql).run()).rejects.toThrow(/null value/);
    expect(await test.db.prepare("SELECT name FROM users").first("name")).toBe(
      "Existing",
    );
    expect(
      await test.db.prepare("SELECT * FROM configuration").first(),
    ).toBeNull();
  });

  it("refuses an unfinished OAuth signup even without an application profile", async () => {
    await test.db
      .prepare(
        "INSERT INTO auth_users (id,name,email,created_at,updated_at) VALUES ('existing','Existing','existing@example.test','1970-01-01','1970-01-01')",
      )
      .run();
    await expect(test.db.prepare(sql).run()).rejects.toThrow(/null value/);
    expect(
      await test.db
        .prepare("SELECT count(*) AS count FROM auth_users")
        .first("count"),
    ).toBe(1);
    expect(
      await test.db.prepare("SELECT * FROM configuration").first(),
    ).toBeNull();
  });

  it("refuses pending quote submissions without discarding them", async () => {
    await test.db
      .prepare(
        "INSERT INTO quote_submissions (id,language,submitted_by,timestamp,data) VALUES ('pending','english','submitter',0,'{}')",
      )
      .run();
    await expect(test.db.prepare(sql).run()).rejects.toThrow(/null value/);
    expect(
      await test.db.prepare("SELECT id FROM quote_submissions").first("id"),
    ).toBe("pending");
    expect(
      await test.db.prepare("SELECT * FROM configuration").first(),
    ).toBeNull();
  });
});
