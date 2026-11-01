import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { resultRuntime, scoreEvent } from "./result-support";
import { withRuntime } from "../../src/runtime/env";
import * as Users from "../../src/dal/user";
import objectHash from "object-hash";
import { buildDbResult } from "../../src/utils/result";
import { addResult } from "../../src/dal/result";
import type { CompletedEvent } from "@caret/schemas/results";

describe("result submission validation with PostgreSQL", () => {
  let test: Awaited<ReturnType<typeof resultRuntime>>;
  beforeAll(async () => {
    test = await resultRuntime();
  });
  afterAll(async () => await test?.dispose());

  it("exports owned results with a stable cursor across equal timestamps", async () => {
    const account = await test.account();
    await withRuntime(test.env, async () => {
      for (const suffix of ["a", "b", "c"]) {
        const result = buildDbResult(scoreEvent(account.uid, 80), "Export", false);
        result._id = suffix.repeat(24);
        await addResult(account.uid, result);
      }
    });
    const response = await test.request(account, "/results?exportHistory=true&limit=2");
    expect(response.status, await response.clone().text()).toBe(200);
    const page = await response.json() as { data: { _id: string; timestamp: number }[] };
    expect(page.data.map((result) => result._id)).toEqual(["c".repeat(24), "b".repeat(24)]);
    const last = page.data[1];
    if (last === undefined) throw new Error("Missing cursor");
    const rest = await test.request(account, `/results?exportHistory=true&limit=2&beforeTimestamp=${last.timestamp}&beforeId=${last._id}`);
    expect(rest.status, await rest.clone().text()).toBe(200);
    expect(await rest.json()).toMatchObject({ data: [{ _id: "a".repeat(24) }] });
  });

  it("acknowledges a committed retry without granting progression twice", async () => {
    const account = await test.account();
    const result = scoreEvent(account.uid, 80);
    const { hash: _hash, ...payload } = result;
    result.hash = objectHash(payload);
    const first = await test.request(account, "/results", "POST", {
      result,
      acknowledgeDuplicate: true,
    });
    expect(first.status, await first.clone().text()).toBe(200);
    const firstBody = (await first.json()) as { data: { insertedId: string } };
    const retry = await test.request(account, "/results", "POST", {
      result,
      acknowledgeDuplicate: true,
    });
    expect(retry.status, await retry.clone().text()).toBe(200);
    expect(await retry.json()).toMatchObject({
      data: {
        insertedId: firstBody.data.insertedId,
        alreadySaved: true,
        xp: 0,
      },
    });
    const user = await withRuntime(
      test.env,
      async () => await Users.getUser(account.uid, "test"),
    );
    expect(user.completedTests).toBe(1);
    const stored = await test.db
      .prepare("SELECT data FROM results WHERE uid=?")
      .bind(account.uid)
      .first<string>("data");
    expect(JSON.parse(stored ?? "null")).toMatchObject({
      verification: "absent",
    });
  });

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
    const data = await test.db
      .prepare(
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

  it("persists sparse key telemetry only when its endpoints cover the test", async () => {
    // The Wasm regression exercises this shape from a retained pre-start key
    // followed by input events without keydowns. No anticheat bypass is used.
    const result: Partial<CompletedEvent> = {
      wpm: 123.2,
      rawWpm: 123.2,
      acc: 100,
      charStats: [154, 0, 0, 0],
      charTotal: 154,
      chartData: { wpm: [123], burst: [120], err: [0] },
      consistency: 100,
      wpmConsistency: 100,
      keySpacing: [],
      keyDuration: [0],
      keyConsistency: 0,
      startToFirstKey: 0,
      lastKeyToEnd: 15000,
      keyOverlap: 0,
    };
    for (const extraTime of [0, 201]) {
      const account = await test.account();
      const response = await test.submit(account, {
        ...result,
        lastKeyToEnd: 15000 + extraTime,
      });
      const accepted = extraTime === 0;
      expect(response.status, await response.clone().text()).toBe(
        accepted ? 200 : 463,
      );
      const profile = await withRuntime(
        test.env,
        async () => await Users.getUser(account.uid, "test"),
      );
      expect(profile.completedTests ?? 0).toBe(accepted ? 1 : 0);
      expect(
        await test.db
          .prepare("SELECT count(*) AS n FROM results WHERE uid=?")
          .bind(account.uid)
          .first("n"),
      ).toBe(accepted ? 1 : 0);
    }
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
            await test.db
              .prepare(`SELECT count(*) AS n FROM ${table} WHERE uid=?`)
              .bind(account.uid)
              .first("n"),
          ).toBe(0);
        }
        expect(
          await test.db
            .prepare(
              "SELECT count(*) AS n FROM audit_logs WHERE uid=? AND event='anticheat_rejected'",
            )
            .bind(account.uid)
            .first("n"),
        ).toBe(1);
      });
    },
  );
});
