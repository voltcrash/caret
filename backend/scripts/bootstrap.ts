import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { databaseUrl } from "./database-url";

async function main(): Promise<void> {
  const sql = neon(await databaseUrl());
  await sql.query(await readFile(new URL("../bootstrap/production.sql", import.meta.url), "utf8"));
  console.log("Fresh PostgreSQL database initialized");
}
void main().catch(() => { console.error("Bootstrap failed; target must be migrated and empty"); process.exitCode = 1; });
