import { readFile } from "node:fs/promises";
import { z } from "zod";
import { retireTaskConsumer } from "./retired-task-consumer";

async function main(): Promise<void> {
  const environment = z.enum(["production", "staging"]).parse(process.argv[2]);
  const config = z
    .object({ account_id: z.string().min(1), name: z.string().min(1) })
    .parse(
      JSON.parse(
        await readFile(
          new URL(`../wrangler.${environment}.json`, import.meta.url),
          "utf8",
        ),
      ),
    );
  const removed = await retireTaskConsumer({
    accountId: config.account_id,
    queueName: `oxytype-${environment}-tasks`,
    workerName: config.name,
    apiToken: process.env["CLOUDFLARE_API_TOKEN"] ?? "",
  });
  console.log(`Retired ${removed} ${environment} task consumer(s)`);
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Task consumer retirement failed",
  );
  process.exitCode = 1;
});
