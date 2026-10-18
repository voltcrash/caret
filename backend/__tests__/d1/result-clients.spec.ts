import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";
import { withRuntime } from "../../src/runtime/env";
import * as Results from "../../src/dal/result";
import { buildDbResult } from "../../src/utils/result";
import { completedEvent } from "../__testData__/completed-event";
import { CompletedEventSchema } from "@oxytype/schemas/results";

describe("web result history", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime({
      beforeMigration: async (db, file) => {
        if (file !== "0009_result_client.sql") return;
        await db
          .prepare(
            "INSERT INTO users(uid,id,name,name_key,email,added_at,data) VALUES('legacy','legacy','legacy','legacy','legacy@example.test',0,'{}')",
          )
          .run();
        await db
          .prepare(
            "INSERT INTO results(id,uid,timestamp,mode,mode2,language,wpm,acc,data) VALUES('legacy-result','legacy',1000,'time','30','english',80,95,'{}')",
          )
          .run();
      },
    });
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
    expect(
      await test.env.DB.prepare(
        "SELECT client FROM results WHERE id='legacy-result'",
      ).first("client"),
    ).toBe("web");
    await withRuntime(test.env, async () => {
      expect((await Results.getResult("legacy", "legacy-result")).client).toBe(
        "web",
      );
    });
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
      expect(await Results.getLastResultTimestamp("client-history")).toBe(5000);
    });
  });
  it("keeps retired-client rows out of web history and direct reads", async () => {
    await test.env.DB.prepare(
      "INSERT INTO results(id,uid,timestamp,mode,mode2,language,wpm,acc,client,data) VALUES('retired-result','client-history',6000,'time','30','english',80,95,'tui','{}')",
    ).run();
    await withRuntime(test.env, async () => {
      expect(
        (await Results.getResults("client-history")).some(
          (row) => row._id === "retired-result",
        ),
      ).toBe(false);
      await expect(
        Results.getResult("client-history", "retired-result"),
      ).rejects.toThrow("Result not found");
      await expect(
        Results.updateTags("client-history", "retired-result", []),
      ).rejects.toThrow("Result not found");
    });
    expect(
      await test.env.DB.prepare(
        "SELECT count(*) AS n FROM results WHERE id='retired-result'",
      ).first("n"),
    ).toBe(1);
  });
});
