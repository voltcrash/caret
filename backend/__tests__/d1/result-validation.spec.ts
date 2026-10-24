import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { resultRuntime, scoreEvent } from "./result-support";
import { withRuntime } from "../../src/runtime/env";
import * as Users from "../../src/dal/user";
import type { CompletedEvent } from "@oxytype/schemas/results";

describe("result submission validation with D1", () => {
  let test: Awaited<ReturnType<typeof resultRuntime>>;
  beforeAll(async () => {
    test = await resultRuntime();
  });
  afterAll(async () => await test?.dispose());

  it("rejects a malformed submission before progression", async () => {
    const account = await test.account();
    const response = await test.request(account, "/results", "POST", {
      result: { mode: "unknown" },
    });
    expect(response.status, await response.clone().text()).toBe(422);
    expect(
      (
        await withRuntime(
          test.env,
          async () => await Users.getUser(account.uid, "test"),
        )
      ).completedTests,
    ).toBeUndefined();
  });

  it("rejects a forged hash on an otherwise valid submission", async () => {
    const account = await test.account();
    const response = await test.request(account, "/results", "POST", {
      result: { ...scoreEvent(account.uid, 80), hash: "forged" },
    });
    expect(response.status, await response.clone().text()).toBe(461);
    expect(
      (
        await withRuntime(
          test.env,
          async () => await Users.getUser(account.uid, "test"),
        )
      ).completedTests,
    ).toBeUndefined();
  });

  it("records numeric endpoints for rejected key timelines", async () => {
    const account = await test.account();
    const response = await test.submit(account, { lastKeyToEnd: 0 });
    expect(response.status, await response.clone().text()).toBe(463);
    const data = await test.env.DB.prepare(
      "SELECT data FROM audit_logs WHERE uid=? AND event='anticheat_rejected'",
    )
      .bind(account.uid)
      .first<string>("data");
    const result = scoreEvent(account.uid, 80);
    expect(JSON.parse(data ?? "null")).toEqual({
      message: {
        reason: "key-timeline-mismatch",
        submissionHash: expect.any(String),
        client: "web",
        mode: "time",
        mode2: "15",
        keyTimeline: {
          testDurationMs: 15000,
          startToFirstKey: 0,
          keySpacingTotal:
            result.keySpacing === "toolong"
              ? 0
              : result.keySpacing.reduce((sum, value) => sum + value, 0),
          lastKeyToEnd: 0,
          keyCount: 110,
        },
      },
    });
  });

  it.each([
    ["character counts", { charTotal: 1 }],
    ["unearned restart credit", { restartCount: 1 }],
    ["short advertised duration", { mode2: "60" }],
    ["falsified consistency", { consistency: 0 }],
    ["forged score", { wpm: 120 }],
  ] satisfies [string, Partial<CompletedEvent>][])(
    "rejects inconsistent %s without PB, rank or XP writes",
    async (_name, changes) => {
      const account = await test.account();
      const response = await test.submit(account, changes);
      expect(response.status, await response.clone().text()).toBe(463);
      await withRuntime(test.env, async () => {
        const user = await Users.getUser(account.uid, "test");
        expect(user.personalBests.time).toEqual({});
        expect(user.xp).toBeUndefined();
        expect(user.completedTests).toBeUndefined();
        for (const table of ["results", "daily_entries", "weekly_entries"]) {
          expect(
            await test.env.DB.prepare(
              `SELECT count(*) AS n FROM ${table} WHERE uid=?`,
            )
              .bind(account.uid)
              .first("n"),
          ).toBe(0);
        }
        expect(
          await test.env.DB.prepare(
            "SELECT count(*) AS n FROM audit_logs WHERE uid=? AND event='anticheat_rejected'",
          )
            .bind(account.uid)
            .first("n"),
        ).toBe(1);
      });
    },
  );
});
