import { readFile } from "node:fs/promises";
import { z } from "zod";
import { enableD1ReadReplication } from "./d1-read-replication";

async function main(): Promise<void> {
  const environment = z.enum(["production", "staging"]).parse(process.argv[2]);
  const config = z
    .object({
      account_id: z.string().min(1),
      d1_databases: z.array(
        z.object({
          binding: z.string(),
          database_id: z.uuid(),
          database_name: z.string().min(1),
        }),
      ),
    })
    .parse(
      JSON.parse(
        await readFile(
          new URL(`../wrangler.${environment}.json`, import.meta.url),
          "utf8",
        ),
      ),
    );
  const databases = config.d1_databases.filter(
    ({ binding }) => binding === "DB",
  );
  const database = databases[0];
  if (databases.length !== 1 || database === undefined) {
    throw new Error("Expected exactly one D1 DB binding");
  }
  await enableD1ReadReplication({
    accountId: config.account_id,
    databaseId: database.database_id,
    databaseName: database.database_name,
    apiToken: process.env["CLOUDFLARE_API_TOKEN"] ?? "",
  });
  console.log(`D1 read replication enabled: ${database.database_name}`);
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "D1 read replication setup failed",
  );
  process.exitCode = 1;
});
