import { execFile } from "node:child_process";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import {
  insightLimits,
  insightSummary,
  summarizeInsights,
} from "./d1-query-insights";

async function main(): Promise<void> {
  const environment = z.enum(["production", "staging"]).parse(process.argv[2]);
  const root = resolve(import.meta.dirname, "..");
  const configPath = resolve(root, `wrangler.${environment}.json`);
  const config = z
    .object({
      d1_databases: z.array(
        z.object({
          binding: z.string(),
          database_name: z.string().regex(/^[\w-]+$/),
        }),
      ),
    })
    .parse(JSON.parse(await readFile(configPath, "utf8")));
  const databases = config.d1_databases.filter(
    ({ binding }) => binding === "DB",
  );
  const database = databases[0];
  if (databases.length !== 1 || database === undefined) {
    throw new Error("Expected one D1 DB binding");
  }
  const groups: Record<string, ReturnType<typeof summarizeInsights>> = {};
  for (const [category, sortBy, sortType] of [
    ["total-time", "time", "sum"],
    ["average-time", "time", "avg"],
    ["rows-read", "reads", "sum"],
    ["rows-written", "writes", "sum"],
  ] as const) {
    const { stdout } = await promisify(execFile)(
      "vp",
      [
        "exec",
        "wrangler",
        "d1",
        "insights",
        database.database_name,
        "--config",
        configPath,
        "--time-period",
        "1d",
        "--limit",
        "20",
        "--sort-by",
        sortBy,
        "--sort-type",
        sortType,
        "--json",
      ],
      { cwd: root, timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
    );
    groups[category] = summarizeInsights(JSON.parse(stdout));
  }
  const output = resolve(root, ".reports/d1");
  await mkdir(output, { recursive: true });
  const report = {
    environment,
    database: database.database_name,
    capturedAt: new Date().toISOString(),
    period: "1d",
    limits: insightLimits,
    groups,
  };
  await writeFile(
    resolve(output, `${environment}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  const summary = insightSummary(database.database_name, groups);
  await writeFile(resolve(output, `${environment}.md`), summary);
  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  if (summaryPath !== undefined && summaryPath !== "") {
    await appendFile(summaryPath, `${summary}\n`);
  }
  const warned = new Set(
    Object.values(groups)
      .flat()
      .filter(({ warnings }) => warnings.length > 0)
      .map(({ queryId }) => queryId),
  );
  console.log(
    `${database.database_name}: ${warned.size} queries exceed advisory thresholds; reports in ${output}`,
  );
  if (warned.size > 0 && process.env["GITHUB_ACTIONS"] === "true") {
    console.log(
      `::warning::D1 ${environment}: ${warned.size} queries exceed advisory thresholds; inspect the job summary`,
    );
  }
}

void main().catch(() => {
  // Child-process errors contain stdout/stderr, potentially including SQL.
  console.error(
    "D1 Insights report failed. Check Cloudflare authentication, Analytics read permissions and Wrangler compatibility; no raw SQL was logged.",
  );
  process.exitCode = 1;
});
