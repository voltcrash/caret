import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import { neon } from "@neondatabase/serverless";
import { TestDatabase } from "./database";
import { migrateDatabase } from "../../scripts/migrations";

let db: TestDatabase;
beforeAll(() => {
  db = new TestDatabase();
});
afterAll(async () => await db?.close());
it("applies and journals PostgreSQL migrations, initializes fresh config, and preserves updates on rerun", async () => {
  const sql = neon(db.url);
  await migrateDatabase(sql);
  expect(
    await db
      .prepare("SELECT count(*) AS count FROM drizzle.__drizzle_migrations")
      .first("count"),
  ).toBe(2);
  expect(
    await db
      .prepare(
        "SELECT data #>> '{users,signUp}' AS signup FROM configuration WHERE id='main'",
      )
      .first("signup"),
  ).toBe("true");
  await db
    .prepare(
      "UPDATE configuration SET data=jsonb_set(data,'{users,signUp}','false'::jsonb), version=7 WHERE id='main'",
    )
    .run();
  await migrateDatabase(sql);
  expect(
    await db
      .prepare("SELECT version FROM configuration WHERE id='main'")
      .first("version"),
  ).toBe(7);
  expect(
    await db
      .prepare(
        "SELECT data #>> '{users,signUp}' AS signup FROM configuration WHERE id='main'",
      )
      .first("signup"),
  ).toBe("false");
  expect(
    await db.prepare("SELECT count(*) AS count FROM users").first("count"),
  ).toBe(0);
});
