import { neon } from "@neondatabase/serverless";
import { databaseUrl } from "./database-url";
import { migrateDatabase } from "./migrations";

async function main(): Promise<void> {
  await migrateDatabase(neon(await databaseUrl()));
  console.log("PostgreSQL migrations applied; fresh databases initialized");
}
void main().catch(() => { console.error("PostgreSQL migration failed; check DATABASE_URL and database access"); process.exitCode = 1; });
