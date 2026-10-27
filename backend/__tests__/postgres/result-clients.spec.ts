import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";
import { withRuntime } from "../../src/runtime/env";
import * as Results from "../../src/dal/result";
import { buildDbResult } from "../../src/utils/result";
import { completedEvent } from "../__testData__/completed-event";
import { CompletedEventSchema } from "@caret/schemas/results";

describe("web result history", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime();
    await seedUser(test.env, "client-history");
  });
  afterAll(async () => await test?.dispose());
  it("backfills legacy results and defaults omitted clients to web", async () => {
    const { client: _client, ...legacy } = completedEvent();
    expect(CompletedEventSchema.parse(legacy).client).toBe("web");
    expect(
      CompletedEventSchema.safeParse({ ...legacy, client: "unknown" }).success,
    ).toBe(false);
    expect(
      CompletedEventSchema.safeParse({ ...legacy, client: "tui" }).success,
    ).toBe(false);

  });
  it("paginates web results and tracks the latest timestamp", async () => {
    await withRuntime(test.env, async () => {
      for (const timestamp of [2000, 4000, 5000]) {
        await Results.addResult(
          "client-history",
          buildDbResult(
            completedEvent({ uid: "client-history", timestamp }),
            "history",
            false,
          ),
        );
      }
      expect(
        (
          await Results.getResults("client-history", { limit: 1, offset: 1 })
        ).map((row) => row.timestamp),
      ).toEqual([4000]);
      const [summary] = await Results.getResults("client-history", {
        limit: 1,
      });
      expect(summary).toMatchObject({ timestamp: 5000, uid: "client-history" });
      for (const key of [
        "chartData",
        "keySpacingStats",
        "keyDurationStats",
        "name",
      ]) {
        expect(summary).not.toHaveProperty(key);
      }
      expect(
        (await Results.getResult("client-history", summary?._id ?? ""))
          .chartData,
      ).toBeDefined();
      expect(await Results.getLastResultTimestamp("client-history")).toBe(5000);
    });
  });
  it("rejects retired clients at the database boundary", async () => {
    await expect(test.db.prepare("INSERT INTO results(id,uid,timestamp,mode,mode2,language,wpm,acc,client,data) VALUES('retired-result','client-history',6000,'time','30','english',80,95,'tui','{}')").run()).rejects.toThrow("results_client");
  });
});
