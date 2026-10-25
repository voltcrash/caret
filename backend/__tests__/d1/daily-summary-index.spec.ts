import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createTestRuntime } from "./helpers";

describe("daily leaderboard summary index", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime();
  });
  afterAll(async () => await test.dispose());

  it("answers count and min wpm from the covering index", async () => {
    // Same statement as db/ranking.ts for a daily board.
    const plan = await test.env.DB.prepare(
      "EXPLAIN QUERY PLAN SELECT count(*) AS count,coalesce(min(json_extract(data,'$.wpm')),0) AS minWpm FROM daily_entries WHERE period=? AND expires_at>? AND board=?",
    )
      .bind(1, 0, "time-15-english")
      .all<{ detail: string }>();
    expect(plan.results.map(({ detail }) => detail).join("\n")).toContain(
      "USING COVERING INDEX daily_entries_summary_idx",
    );
  });
});
