import { describe, expect, it } from "vite-plus/test";
import { createHash } from "node:crypto";
import {
  insightSummary,
  summarizeInsights,
} from "../../scripts/d1-query-insights";

const query = {
  query: "SELECT * FROM users WHERE email='private@example.test'",
  avgRowsRead: 2000,
  totalRowsRead: 40000,
  avgRowsWritten: 0,
  totalRowsWritten: 0,
  avgDurationMs: 60,
  totalDurationMs: 1200,
  numberOfTimesRun: 20,
};

describe("D1 Insights reports", () => {
  it("keeps metrics and stable query identities without captured SQL", () => {
    const report = summarizeInsights([query]);
    expect(report[0]).toMatchObject({
      queryId: createHash("sha256").update(query.query).digest("hex"),
      warnings: ["slow-query", "high-row-scan"],
      totalRowsRead: 40000,
    });
    const markdown = insightSummary("caret-production", {
      "total-time": report,
    });
    for (const text of [JSON.stringify(report), markdown]) {
      expect(text).not.toContain("private@example.test");
      expect(text).not.toContain("SELECT");
    }
    expect(markdown).toContain("not whole-database totals");
    expect(markdown).toContain("slow-query");
  });

  it("does not warn for isolated outliers or fast indexed queries", () => {
    expect(
      summarizeInsights([{ ...query, numberOfTimesRun: 1 }])[0]?.warnings,
    ).toEqual([]);
    expect(
      summarizeInsights([{ ...query, avgDurationMs: 1, avgRowsRead: 1 }])[0]
        ?.warnings,
    ).toEqual([]);
  });

  it("keeps an empty sampling window explicit", () => {
    expect(
      insightSummary("caret-staging", {
        "total-time": summarizeInsights([]),
      }),
    ).toContain("No query samples returned");
  });

  it.each([
    null,
    [{ ...query, avgRowsRead: -1 }],
    [{ ...query, avgDurationMs: Number.NaN }],
    [{ ...query, avgDurationMs: Number.POSITIVE_INFINITY }],
    [{ query: query.query }],
  ])("rejects incomplete or invalid metrics (%j)", (input) => {
    expect(() => summarizeInsights(input)).toThrow();
  });
});
