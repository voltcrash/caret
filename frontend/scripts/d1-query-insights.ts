import { createHash } from "node:crypto";
import { z } from "zod";

const metric = z.number().nonnegative();
const insightsSchema = z.array(
  z.object({
    query: z.string(),
    avgRowsRead: metric,
    totalRowsRead: metric,
    avgRowsWritten: metric,
    totalRowsWritten: metric,
    avgDurationMs: metric,
    totalDurationMs: metric,
    numberOfTimesRun: metric,
  }),
);

export const insightLimits = {
  minExecutions: 10,
  avgDurationMs: 50,
  avgRowsRead: 1000,
};

/** Persist query identities and metrics, never captured SQL or literal values. */
export function summarizeInsights(input: unknown): {
  queryId: string;
  avgRowsRead: number;
  totalRowsRead: number;
  avgRowsWritten: number;
  totalRowsWritten: number;
  avgDurationMs: number;
  totalDurationMs: number;
  numberOfTimesRun: number;
  warnings: string[];
}[] {
  return insightsSchema.parse(input).map(({ query, ...metrics }) => {
    const warnings: string[] = [];
    if (metrics.numberOfTimesRun >= insightLimits.minExecutions) {
      if (metrics.avgDurationMs >= insightLimits.avgDurationMs) {
        warnings.push("slow-query");
      }
      if (metrics.avgRowsRead >= insightLimits.avgRowsRead) {
        warnings.push("high-row-scan");
      }
    }
    return {
      queryId: createHash("sha256").update(query).digest("hex"),
      ...metrics,
      warnings,
    };
  });
}

export function insightSummary(
  database: string,
  groups: Record<string, ReturnType<typeof summarizeInsights>>,
): string {
  const lines = [
    `## D1 Query Insights: ${database}`,
    "",
    "Last 24 hours; top 20 per category. Sampled metrics, not whole-database totals. Query IDs are SHA-256 of captured SQL; SQL is omitted from reports.",
    "",
  ];
  for (const [category, queries] of Object.entries(groups)) {
    lines.push(
      `### ${category}`,
      "",
      "| Query ID | Calls | Avg ms | Total ms | Avg rows read | Total rows read | Total rows written | Warnings |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    );
    for (const query of queries) {
      lines.push(
        `| ${query.queryId} | ${query.numberOfTimesRun} | ${query.avgDurationMs.toFixed(2)} | ${query.totalDurationMs.toFixed(2)} | ${query.avgRowsRead.toFixed(1)} | ${query.totalRowsRead} | ${query.totalRowsWritten} | ${query.warnings.join(", ")} |`,
      );
    }
    if (queries.length === 0) lines.push("", "No query samples returned.");
    lines.push("");
  }
  return lines.join("\n");
}
