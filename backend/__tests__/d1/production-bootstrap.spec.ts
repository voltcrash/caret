import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { ConfigurationSchema } from "@oxytype/schemas/configuration";
import { getLiveConfiguration } from "../../src/init/configuration";
import { withRuntime } from "../../src/runtime/env";
import { createTestRuntime, seedUser } from "./helpers";

describe("fresh production bootstrap on D1", () => {
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
    await test.env.DB.prepare(sql).run();
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
    const counts = await test.env.DB.prepare(
      "SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM auth_users) AS auth, (SELECT count(*) FROM results) AS results",
    ).first();
    expect(counts).toEqual({
      users: 0,
      auth: 0,
      results: 0,
    });
  });

  it("refuses to replace existing configuration on a rerun", async () => {
    await test.env.DB.prepare(sql).run();
    await test.env.DB.prepare(
      "UPDATE configuration SET version=7,data=json_set(data,'$.users.signUp',json('false')) WHERE id='main'",
    ).run();
    const before = await test.env.DB.prepare(
      "SELECT * FROM configuration",
    ).first();
    await expect(test.env.DB.prepare(sql).run()).rejects.toThrow(/NOT NULL/);
    expect(
      await test.env.DB.prepare("SELECT * FROM configuration").first(),
    ).toEqual(before);
  });

  it("refuses a target containing an application user", async () => {
    await seedUser(test.env, "existing", "Existing");
    await expect(test.env.DB.prepare(sql).run()).rejects.toThrow(/NOT NULL/);
    expect(
      await test.env.DB.prepare("SELECT name FROM users").first("name"),
    ).toBe("Existing");
    expect(
      await test.env.DB.prepare("SELECT * FROM configuration").first(),
    ).toBeNull();
  });

  it("refuses an unfinished OAuth signup even without an application profile", async () => {
    await test.env.DB.prepare(
      "INSERT INTO auth_users (id,name,email,created_at,updated_at) VALUES ('existing','Existing','existing@example.test',0,0)",
    ).run();
    await expect(test.env.DB.prepare(sql).run()).rejects.toThrow(/NOT NULL/);
    expect(
      await test.env.DB.prepare(
        "SELECT count(*) AS count FROM auth_users",
      ).first("count"),
    ).toBe(1);
    expect(
      await test.env.DB.prepare("SELECT * FROM configuration").first(),
    ).toBeNull();
  });

  it("refuses pending deliveries without discarding them", async () => {
    await test.env.DB.prepare(
      "INSERT INTO outbox (id,type,created_at,data) VALUES ('pending','reward',0,'{}')",
    ).run();
    await expect(test.env.DB.prepare(sql).run()).rejects.toThrow(/NOT NULL/);
    expect(await test.env.DB.prepare("SELECT id FROM outbox").first("id")).toBe(
      "pending",
    );
    expect(
      await test.env.DB.prepare("SELECT * FROM configuration").first(),
    ).toBeNull();
  });
});
