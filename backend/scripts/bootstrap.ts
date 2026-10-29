import { readFile } from "node:fs/promises";
import { DatabaseClient } from "../src/db/connection";
import { databaseUrl } from "./database-url";

async function main(): Promise<void> {
  const sql = new DatabaseClient(await databaseUrl());
  try {
    await sql.query(
      await readFile(
        new URL("../bootstrap/production.sql", import.meta.url),
        "utf8",
      ),
    );
    console.log("Fresh PostgreSQL database initialized");
  } finally {
    await sql.end();
  }
}
void main().catch(() => {
  console.error("Bootstrap failed; target must be migrated and empty");
  process.exitCode = 1;
});
