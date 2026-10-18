import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import objectHash from "object-hash";
import type { ExecutionContext } from "@cloudflare/workers-types";
import type { CompletedEvent } from "@oxytype/schemas/results";
import { createTestRuntime } from "./helpers";
import { withRuntime } from "../../src/runtime/env";
import { getAuth } from "../../src/init/auth";
import { patchConfiguration } from "../../src/init/configuration";
import * as Users from "../../src/dal/user";
import * as Public from "../../src/dal/public";
import * as Logs from "../../src/dal/logs";
import { mutateUser } from "../../src/db/mutation";
import Worker from "../__testData__/http-worker";
import { completedEvent } from "../__testData__/completed-event";
import {
  generatedTimings,
  humanTimings,
  type KeyTimings,
} from "../__testData__/key-timings";
import { consistency } from "../../src/anticheat/result";

describe("production anticheat with D1", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  let index = 0;
  const execution = {
    waitUntil: () => undefined,
  } as unknown as ExecutionContext;
  beforeAll(async () => {
    test = await createTestRuntime();
    test.env.MODE = "production";
    test.env.BETTER_AUTH_URL = "http://localhost:5005/api/auth";
    test.env.BETTER_AUTH_SECRET =
      "anticheat-test-secret-at-least-thirty-two-characters";
    await withRuntime(test.env, async () => {
      await patchConfiguration({
        results: { savingEnabled: true, objectHashCheckEnabled: true },
        users: { inbox: { enabled: true, maxMail: 10 } },
      });
    });
  });
  afterAll(async () => await test?.dispose());

  async function account(
    ageSeconds = 300,
  ): Promise<{ uid: string; token: string }> {
    return await withRuntime(test.env, async () => {
      const auth = await getAuth().$context;
      const user = await auth.internalAdapter.createUser(
        {
          name: `Typing${index}`,
          email: `typing${index++}@example.com`,
          emailVerified: true,
        },
        { method: "oauth", oauth: { providerId: "github" } },
      );
      await Users.addUser(user.name, user.email, user.id);
      const createdAt = Date.now() - ageSeconds * 1000;
      await test.env.DB.prepare(
        "UPDATE users SET added_at=?,data=json_set(data,'$.addedAt',?) WHERE uid=?",
      )
        .bind(createdAt, createdAt, user.id)
        .run();
      const session = await auth.internalAdapter.createSession(user.id, false);
      if (session === null) throw new Error("Missing session");
      return { uid: user.id, token: session.token };
    });
  }
  async function submit(
    user: { uid: string; token: string },
    changes: Partial<CompletedEvent> = {},
    path = "/api/results",
  ): Promise<Response> {
    const { hash: _hash, ...result } = completedEvent({
      ...changes,
      uid: user.uid,
    });
    return await Worker.fetch(
      new Request(`http://localhost:5005${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${user.token}`,
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          result: { ...result, hash: objectHash(result) },
        }),
      }),
      test.env,
      execution,
    );
  }
  async function assertNoProgress(uid: string): Promise<void> {
    await withRuntime(test.env, async () => {
      const user = await Users.getUser(uid, "anticheat test");
      expect(user.xp ?? 0).toBe(0);
      expect(user.completedTests ?? 0).toBe(0);
      expect(user.timeTyping ?? 0).toBe(0);
      expect(user.personalBests.time).toEqual({});
      expect(
        await test.env.DB.prepare(
          "SELECT count(*) AS count FROM results WHERE uid=?",
        )
          .bind(uid)
          .first("count"),
      ).toBe(0);
      expect(
        await test.env.DB.prepare(
          "SELECT count(*) AS count FROM daily_entries WHERE uid=?",
        )
          .bind(uid)
          .first("count"),
      ).toBe(0);
      expect(
        await test.env.DB.prepare(
          "SELECT count(*) AS count FROM weekly_entries WHERE uid=?",
        )
          .bind(uid)
          .first("count"),
      ).toBe(0);
    });
  }
  function fixedResult(): Partial<CompletedEvent> {
    return {
      wpm: 160,
      rawWpm: 160,
      acc: 100,
      charStats: [400, 0, 0, 0],
      charTotal: 400,
      keySpacing: Array.from({ length: 399 }, () => 75),
      keyDuration: Array.from({ length: 400 }, () => 25),
      keyConsistency: 100,
      lastKeyToEnd: 75,
      keyOverlap: 0,
    };
  }

  /** A consistent 240 WPM, 30-second result around the given key timings. */
  function timedResult({
    keySpacing,
    keyDuration,
  }: KeyTimings): Partial<CompletedEvent> {
    const total = keySpacing.reduce((sum, value) => sum + value, 0);
    const scale = Math.min(1, 29_000 / total);
    const spacing = keySpacing.map((value) => value * scale);
    return {
      wpm: 240,
      rawWpm: 240,
      acc: 100,
      charStats: [600, 0, 0, 0],
      charTotal: 600,
      keySpacing: spacing,
      keyDuration,
      keyConsistency: consistency(spacing.slice(0, -1)),
      lastKeyToEnd: 30_000 - spacing.reduce((sum, value) => sum + value, 0),
      keyOverlap: 0,
    };
  }
  const uniformBot = (): Partial<CompletedEvent> =>
    timedResult(
      generatedTimings(600, (random, channel) =>
        channel === "gap" ? 30 + random() * 20 : 20 + random() * 20,
      ),
    );
  async function auditLogs(
    uid: string,
    event: string,
  ): Promise<{ message: Record<string, unknown> }[]> {
    const { results } = await test.env.DB.prepare(
      "SELECT data FROM audit_logs WHERE uid=? AND event=?",
    )
      .bind(uid, event)
      .all<{ data: string }>();
    return results.map(
      (row) => JSON.parse(row.data) as { message: Record<string, unknown> },
    );
  }
  // results must be spaced by their duration; age earlier saves instead of waiting
  async function ageResults(uid: string): Promise<void> {
    await test.env.DB.prepare(
      "UPDATE results SET timestamp=timestamp-120000 WHERE uid=?",
    )
      .bind(uid)
      .run();
  }
  async function withAnticheat(
    anticheat: Parameters<typeof patchConfiguration>[0]["anticheat"],
    run: () => Promise<void>,
  ): Promise<void> {
    await withRuntime(
      test.env,
      async () => await patchConfiguration({ anticheat }),
    );
    try {
      await run();
    } finally {
      await withRuntime(
        test.env,
        async () =>
          await patchConfiguration({
            anticheat: {
              review: {
                enabled: true,
                minWpm: 100,
                suspiciousAfterFlags: 5,
                suspiciousWindowHours: 168,
              },
              samples: { captureFlagged: false, randomRate: 0 },
              replayCheck: { enabled: true, maxFingerprints: 50 },
            },
          }),
      );
    }
  }

  it("saves valid production results without a bypass and updates progression", async () => {
    const user = await account();
    const response = await submit(user);
    expect(response.status, await response.clone().text()).toBe(200);
    await withRuntime(test.env, async () => {
      const profile = await Users.getUser(user.uid, "test");
      expect(profile.completedTests).toBe(1);
      expect(profile.timeTyping).toBe(30);
      expect(profile.xp).toBeGreaterThan(0);
      expect(
        await test.env.DB.prepare(
          "SELECT count(*) AS count FROM results WHERE uid=?",
        )
          .bind(user.uid)
          .first("count"),
      ).toBe(1);
    });
  });
  it("bounds first-result duration to server account age, ignoring the client timestamp", async () => {
    const user = await account(0);
    expect((await submit(user, { timestamp: 1 })).status).toBe(462);
    await assertNoProgress(user.uid);
    expect(
      await test.env.DB.prepare(
        "SELECT count(*) AS count FROM audit_logs WHERE uid=? AND event='invalid_result_spacing'",
      )
        .bind(user.uid)
        .first("count"),
    ).toBe(1);
  });
  it.each(["/api/results", "/results"])(
    "rejects forged scores at %s without saving progression, even with the old bypass binding",
    async (path) => {
      Object.assign(test.env, { BYPASS_ANTICHEAT: "true" });
      const user = await account();
      expect((await submit(user, { wpm: 120 }, path)).status).toBe(463);
      await assertNoProgress(user.uid);
      expect(
        await test.env.DB.prepare(
          "SELECT count(*) AS count FROM audit_logs WHERE uid=? AND event='anticheat_rejected'",
        )
          .bind(user.uid)
          .first("count"),
      ).toBe(1);
    },
  );
  it("rejects falsified timelines, restart credit and short-test sentinels", async () => {
    for (const changes of [
      { lastKeyToEnd: 0 },
      { incompleteTestSeconds: 500 },
      { chartData: "toolong" },
    ] satisfies Partial<CompletedEvent>[]) {
      const user = await account();
      expect((await submit(user, changes)).status).toBe(463);
      await assertNoProgress(user.uid);
    }
  });
  it("reports missing high-speed telemetry without adding a ban strike", async () => {
    const user = await account();
    expect(
      (
        await submit(user, {
          ...fixedResult(),
          keySpacing: [],
          keyDuration: [],
          keyConsistency: 0,
        })
      ).status,
    ).toBe(464);
    await assertNoProgress(user.uid);
    await withRuntime(test.env, async () =>
      expect(
        (await Users.getUser(user.uid, "test")).autoBanTimestamps,
      ).toBeUndefined(),
    );
  });
  it("rejects fixed-timing bots without banning by default", async () => {
    const user = await account();
    expect((await submit(user, fixedResult())).status).toBe(465);
    await assertNoProgress(user.uid);
    await withRuntime(test.env, async () =>
      expect((await Users.getUser(user.uid, "test")).banned).not.toBe(true),
    );
  });
  it("applies the bot gate only above the configured speed", async () => {
    const user = await account();
    await withRuntime(
      test.env,
      async () =>
        await patchConfiguration({ anticheat: { botCheckMinWpm: 200 } }),
    );
    try {
      const response = await submit(user, fixedResult());
      expect(response.status, await response.clone().text()).toBe(200);
    } finally {
      await withRuntime(
        test.env,
        async () =>
          await patchConfiguration({ anticheat: { botCheckMinWpm: 130 } }),
      );
    }
  });
  it("logs review signals for a saved result without rejecting it or storing timings", async () => {
    const user = await account();
    const response = await submit(user, uniformBot());
    expect(response.status, await response.clone().text()).toBe(200);
    const [flag] = await auditLogs(user.uid, "anticheat_flagged");
    expect(flag?.message).toMatchObject({
      resultId: ((await response.json()) as { data: { insertedId: string } })
        .data.insertedId,
      wpm: 240,
      verified: false,
      signals: expect.arrayContaining(["uniform-gaps", "uniform-holds"]),
    });
    expect(flag?.message["features"]).toBeDefined();
    expect(flag?.message["keySpacing"]).toBeUndefined();
    expect(await auditLogs(user.uid, "anticheat_sample")).toHaveLength(0);
    await withRuntime(test.env, async () => {
      const profile = await Users.getUser(user.uid, "test");
      expect(profile.completedTests).toBe(1);
      expect(profile.autoBanTimestamps).toBeUndefined();
    });
  });
  it("raises no review signal for modelled human timing", async () => {
    const user = await account();
    const response = await submit(user, timedResult(humanTimings(600, 2, 45)));
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await auditLogs(user.uid, "anticheat_flagged")).toHaveLength(0);
  });
  it("captures raw timings of flagged results only when configured", async () => {
    await withAnticheat(
      { samples: { captureFlagged: true, randomRate: 0 } },
      async () => {
        const user = await account();
        expect((await submit(user, uniformBot())).status).toBe(200);
        const [sample] = await auditLogs(user.uid, "anticheat_sample");
        expect(sample?.message["keySpacing"]).toHaveLength(599);
        expect(sample?.message["keyDuration"]).toHaveLength(600);
        expect(sample?.message["signals"]).toContain("uniform-gaps");
      },
    );
  });
  it("captures unflagged baseline samples at the configured rate", async () => {
    await withAnticheat(
      { samples: { captureFlagged: false, randomRate: 1 } },
      async () => {
        const user = await account();
        expect(
          (await submit(user, timedResult(humanTimings(600, 2, 45)))).status,
        ).toBe(200);
        const [sample] = await auditLogs(user.uid, "anticheat_sample");
        expect(sample?.message["signals"]).toEqual([]);
        expect(await auditLogs(user.uid, "anticheat_flagged")).toHaveLength(0);
      },
    );
  });
  it("skips review below the configured speed or when disabled", async () => {
    for (const review of [
      { enabled: true, minWpm: 300 },
      { enabled: false, minWpm: 0 },
    ]) {
      await withAnticheat(
        { review, samples: { captureFlagged: true, randomRate: 1 } },
        async () => {
          const user = await account();
          expect((await submit(user, uniformBot())).status).toBe(200);
          expect(await auditLogs(user.uid, "anticheat_flagged")).toHaveLength(
            0,
          );
          expect(await auditLogs(user.uid, "anticheat_sample")).toHaveLength(0);
        },
      );
    }
  });
  it("marks repeatedly flagged users suspicious without limiting them", async () => {
    await withAnticheat(
      { review: { suspiciousAfterFlags: 2, suspiciousWindowHours: 1 } },
      async () => {
        const user = await account();
        expect((await submit(user, uniformBot())).status).toBe(200);
        await withRuntime(test.env, async () =>
          expect((await Users.getUser(user.uid, "test")).suspicious).toBe(
            undefined,
          ),
        );
        await ageResults(user.uid);
        const second = timedResult(
          generatedTimings(
            600,
            (random, channel) =>
              channel === "gap" ? 30 + random() * 20 : 20 + random() * 20,
            2,
          ),
        );
        expect((await submit(user, second)).status).toBe(200);
        await withRuntime(test.env, async () => {
          const profile = await Users.getUser(user.uid, "test");
          expect(profile.suspicious).toBe(true);
          expect(profile.banned).not.toBe(true);
          expect(profile.completedTests).toBe(2);
        });
        const [marked] = await auditLogs(
          user.uid,
          "anticheat_marked_suspicious",
        );
        expect(marked?.message).toEqual({ flags: 2 });
      },
    );
  });
  it("leaves flagged users unmarked when escalation is disabled", async () => {
    await withAnticheat(
      { review: { suspiciousAfterFlags: 0, suspiciousWindowHours: 1 } },
      async () => {
        const user = await account();
        expect((await submit(user, uniformBot())).status).toBe(200);
        await withRuntime(test.env, async () =>
          expect((await Users.getUser(user.uid, "test")).suspicious).toBe(
            undefined,
          ),
        );
        expect(await auditLogs(user.uid, "anticheat_flagged")).toHaveLength(1);
      },
    );
  });
  it("pages and summarises anticheat audits for admin review", async () => {
    const since = Date.now() - 1000;
    const user = await account();
    expect((await submit(user, { wpm: 120 })).status).toBe(463);
    expect((await submit(user, uniformBot())).status).toBe(200);
    await withRuntime(test.env, async () => {
      const [flag] = await Logs.getLogs({
        event: "anticheat_flagged",
        uid: user.uid,
        limit: 10,
      });
      expect(flag?.message["signals"]).toContain("uniform-gaps");
      expect(
        await Logs.getLogs({
          event: "anticheat_flagged",
          uid: user.uid,
          before: flag?.timestamp ?? 0,
          limit: 10,
        }),
      ).toEqual([]);
      const rejected = await Logs.countLogs(
        "anticheat_rejected",
        since,
        "$.message.reason",
      );
      // other tests in this file also write audits within the window
      const mismatches = rejected.find((row) => row.key === "score-mismatch");
      expect(mismatches?.count).toBeGreaterThanOrEqual(1);
      expect(mismatches?.users).toBeLessThanOrEqual(mismatches?.count ?? 0);
      const flagged = await Logs.countLogs(
        "anticheat_flagged",
        since,
        "$.message.signals",
        true,
      );
      expect(flagged.map((row) => row.key)).toEqual(
        expect.arrayContaining(["uniform-gaps", "uniform-holds"]),
      );
    });
  });
  it("rejects exact duplicate submissions even with timing replay checks disabled", async () => {
    await withAnticheat(
      { replayCheck: { enabled: false, maxFingerprints: 50 } },
      async () => {
        const user = await account();
        expect((await submit(user)).status).toBe(200);
        const saved = await withRuntime(
          test.env,
          async () => await Users.getUser(user.uid, "test"),
        );
        await ageResults(user.uid);
        const response = await submit(user);
        expect(response.status).toBe(466);
        expect(await response.json()).toMatchObject({
          message: "Duplicate result",
        });
        await withRuntime(test.env, async () => {
          const profile = await Users.getUser(user.uid, "test");
          expect(profile.completedTests).toBe(1);
          expect(profile.xp).toBe(saved.xp);
          expect(profile.timeTyping).toBe(saved.timeTyping);
          expect(profile.personalBests).toEqual(saved.personalBests);
        });
        expect(
          await test.env.DB.prepare(
            "SELECT count(*) AS count FROM results WHERE uid=?",
          )
            .bind(user.uid)
            .first("count"),
        ).toBe(1);
      },
    );
  });
  it("rejects a replayed key timeline with changed metadata", async () => {
    const user = await account();
    const timings = timedResult(humanTimings(600, 3, 45));
    expect((await submit(user, timings)).status).toBe(200);
    await ageResults(user.uid);
    expect(
      (await submit(user, { ...timings, timestamp: 2, punctuation: true }))
        .status,
    ).toBe(466);
    const [rejection] = await auditLogs(user.uid, "anticheat_rejected");
    expect(rejection?.message["reason"]).toBe("replayed-key-timing");
    const fresh = timedResult(humanTimings(600, 4, 45));
    expect((await submit(user, fresh)).status).toBe(200);
    await withRuntime(test.env, async () => {
      const profile = await Users.getUser(user.uid, "test");
      expect(profile.completedTests).toBe(2);
      expect(profile.lastTimingHashes).toHaveLength(2);
    });
  });
  it("saves replayed timelines when the replay check is disabled", async () => {
    await withAnticheat(
      { replayCheck: { enabled: false, maxFingerprints: 50 } },
      async () => {
        const user = await account();
        const timings = timedResult(humanTimings(600, 5, 45));
        expect((await submit(user, timings)).status).toBe(200);
        await ageResults(user.uid);
        expect((await submit(user, { ...timings, timestamp: 2 })).status).toBe(
          200,
        );
      },
    );
  });
  it("commits configured strikes and a ban/inbox message despite rejecting the result", async () => {
    const user = await account();
    await withRuntime(
      test.env,
      async () =>
        await patchConfiguration({
          users: { autoBan: { enabled: true, maxCount: 1, maxHours: 1 } },
        }),
    );
    try {
      expect((await submit(user, fixedResult())).status).toBe(465);
      await withRuntime(test.env, async () => {
        const profile = await Users.getUser(user.uid, "test");
        expect(profile.autoBanTimestamps).toHaveLength(1);
        expect(profile.banned).not.toBe(true);
      });
      expect((await submit(user, fixedResult())).status).toBe(465);
      await withRuntime(test.env, async () => {
        const profile = await Users.getUser(user.uid, "test");
        expect(profile.autoBanTimestamps).toHaveLength(2);
        expect(profile.banned).toBe(true);
        expect(profile.inbox).toHaveLength(1);
      });
      await assertNoProgress(user.uid);
      expect(
        await test.env.DB.prepare(
          "SELECT count(*) AS count FROM audit_logs WHERE uid=? AND event='anticheat_rejected'",
        )
          .bind(user.uid)
          .first("count"),
      ).toBe(2);
    } finally {
      await withRuntime(
        test.env,
        async () =>
          await patchConfiguration({ users: { autoBan: { enabled: false } } }),
      );
    }
  });
  it("serializes concurrent strikes, expires old strikes, and leaves public stats unchanged", async () => {
    const user = await account();
    const before = await withRuntime(test.env, async () => {
      await patchConfiguration({
        users: { autoBan: { enabled: true, maxCount: 1, maxHours: 1 } },
      });
      await mutateUser(user.uid, (profile) => {
        profile.autoBanTimestamps = [Date.now() - 2 * 3600_000];
      });
      return await Public.getTypingStats();
    });
    try {
      const responses = await Promise.all([
        submit(user, fixedResult()),
        submit(user, fixedResult()),
      ]);
      expect(responses.map((response) => response.status)).toEqual([465, 465]);
      await withRuntime(test.env, async () => {
        const profile = await Users.getUser(user.uid, "test");
        expect(profile.autoBanTimestamps).toHaveLength(2);
        expect(profile.banned).toBe(true);
        expect(profile.inbox).toHaveLength(1);
        expect(await Public.getTypingStats()).toEqual(before);
      });
      expect(
        await test.env.DB.prepare(
          "SELECT count(*) AS count FROM audit_logs WHERE uid=? AND event='anticheat_rejected'",
        )
          .bind(user.uid)
          .first("count"),
      ).toBe(2);
      await assertNoProgress(user.uid);
    } finally {
      await withRuntime(
        test.env,
        async () =>
          await patchConfiguration({ users: { autoBan: { enabled: false } } }),
      );
    }
  });
  it.each(["verified", "lbOptOut"] as const)(
    "preserves the existing %s exemption for bot heuristics, but still checks scores",
    async (flag) => {
      const user = await account();
      await withRuntime(
        test.env,
        async () =>
          await mutateUser(user.uid, (profile) => {
            profile[flag] = true;
          }),
      );
      expect((await submit(user, { wpm: 120 })).status).toBe(463);
      expect((await submit(user, fixedResult())).status).toBe(200);
    },
  );
  it("keeps long tests and IME results saveable", async () => {
    for (const changes of [
      { keySpacing: [], keyDuration: [], keyConsistency: 0 },
      {
        mode2: "180",
        testDuration: 180,
        wpm: 13.33,
        rawWpm: 14.67,
        chartData: "toolong",
        keySpacing: "toolong",
        keyDuration: "toolong",
      },
    ] satisfies Partial<CompletedEvent>[]) {
      const user = await account();
      const response = await submit(user, changes);
      expect(response.status, await response.clone().text()).toBe(200);
    }
  });
});
