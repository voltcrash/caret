import { readFile } from "node:fs/promises";
import type { NeonQueryFunction } from "@neondatabase/serverless";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { fileURLToPath } from "node:url";

export async function migrateDatabase(sql: NeonQueryFunction<false, false>): Promise<void> {
  await sql.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await sql.query('CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint NOT NULL)');
  const applied = await sql.query('SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1') as { created_at: string }[];
  for (const migration of readMigrationFiles({ migrationsFolder: fileURLToPath(new URL("../migrations/", import.meta.url)) })) {
    if (Number(applied[0]?.created_at ?? -1) >= migration.folderMillis) continue;
    const queries = migration.sql.map(
      // oxlint-disable-next-line typescript/promise-function-async -- Neon batches require their own deferred query promises.
      (query) => sql.query(query),
    );
    queries.push(sql.query('INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES($1,$2)', [migration.hash, migration.folderMillis]));
    await sql.transaction(queries);
  }
  const configuration = await sql.query("SELECT id FROM configuration WHERE id='main'");
  if (configuration.length === 0) {
    await sql.query(await readFile(new URL("../bootstrap/production.sql", import.meta.url), "utf8"));
  }
}
