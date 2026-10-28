import { DatabaseClient } from "../src/db/connection";
import { databaseUrl } from "./database-url";
import { migrateDatabase } from "./migrations";

async function main(): Promise<void> {
  const sql = new DatabaseClient(await databaseUrl());
  try {
    await migrateDatabase(sql);
    console.log("PostgreSQL migrations applied; fresh databases initialized");
  } finally {
    await sql.end();
  }
}
void main().catch(() => {
  console.error(
    "PostgreSQL migration failed; check DATABASE_URL and database access",
  );
  process.exitCode = 1;
});
