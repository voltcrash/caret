import { jobHandler } from "../../src/workers/later-worker";
import { DailyLeaderboard } from "../../src/utils/daily-leaderboards";
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";
import { runtime, withRuntime } from "../../src/runtime/env";
import { __testing, dispatch } from "../../src/runtime/tasks";
import * as UserDAL from "../../src/dal/user";
import * as Quotes from "../../src/dal/new-quotes";
import { BASE_CONFIGURATION } from "../../src/constants/base-configuration";
import { statement } from "../../src/db/client";
import { MonkeyQueue } from "../../src/queues/monkey-queue";
import type { WorkerEnv } from "../../src/runtime/env";

describe("durable queue delivery", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime();
  });
  afterAll(async () => {
    await test?.dispose();
  });
  it("stores long delays durably and publishes IDs after commit", async () => {
    const sendBatch = vi.fn(async () => undefined);
    const env = {
      ...test.env,
      TASKS: { sendBatch } as unknown as WorkerEnv["TASKS"],
    };
    await withRuntime(env, async () => {
      const queue = new MonkeyQueue("reward");
      await queue.add(
        "future",
        { name: "future" },
        { jobId: "long-delay", delay: 7 * 86400000 },
      );
      await queue.add(
        "immediate",
        { name: "immediate" },
        { jobId: "immediate" },
      );
      await dispatch();
      expect(sendBatch).toHaveBeenCalledWith([
        { body: { id: "immediate", kind: "outbox" } },
      ]);
      expect(
        await statement(
          "SELECT count(*) AS count FROM scheduled_jobs WHERE id='long-delay'",
        ).first<number>("count"),
      ).toBe(1);
    });
  });
  it("applies duplicate reward deliveries once", async () => {
    await withRuntime(test.env, async () => {
      await UserDAL.addUser("Recipient", "recipient@example.com", "recipient");
      const mail = {
        id: "rewardDelivery",
        timestamp: Date.now(),
        read: false,
        subject: "Reward",
        body: "Earned",
        rewards: [{ type: "xp", item: 75 }],
      };
      const data = {
        uid: "recipient",
        mail: [mail],
        inboxConfig: {
          ...BASE_CONFIGURATION.users.inbox,
          enabled: true,
          maxMail: 100,
        },
      };
      await statement(
        "INSERT INTO outbox(id,type,uid,created_at,data) VALUES('reward-delivery','reward','recipient',0,?)",
        JSON.stringify(data),
      ).run();
      await __testing.consume({ id: "reward-delivery", kind: "outbox" });
      await __testing.consume({ id: "reward-delivery", kind: "outbox" });
      expect(await UserDAL.getInbox("recipient")).toHaveLength(1);
      await UserDAL.updateInbox("recipient", [mail.id], []);
      expect((await UserDAL.getUser("recipient", "test")).xp).toBe(75);
    });
  });
  it("reuses quote approval idempotency keys and retains failed submissions", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("failure", { status: 503 }))
      .mockResolvedValue(new Response("{}", { status: 200 }));
    try {
      await withRuntime(
        {
          ...test.env,
          INTEGRATION_URL: "https://bridge.example/",
          INTEGRATION_SECRET: "test-secret",
        },
        async () => {
          await statement(
            "INSERT INTO quote_submissions(id,language,submitted_by,timestamp,data) VALUES('approval','english','submitter',0,?)",
            JSON.stringify({
              text: "Quote",
              source: "Source",
              language: "english",
            }),
          ).run();
          await expect(
            Quotes.approve("approval", undefined, undefined, "Moderator"),
          ).rejects.toThrow(/503/);
          expect(
            await statement(
              "SELECT count(*) AS count FROM quote_submissions WHERE id='approval'",
            ).first("count"),
          ).toBe(1);
          await Quotes.approve("approval", undefined, undefined, "Moderator");
          expect(fetch).toHaveBeenCalledTimes(2);
          for (const call of fetch.mock.calls) {
            expect(call[0]).toEqual(
              new URL("https://bridge.example/quotes/approve"),
            );
            expect(call[1]?.headers).toMatchObject({
              "idempotency-key": "quote:approval",
            });
          }
          expect(
            await statement(
              "SELECT count(*) AS count FROM quote_submissions",
            ).first("count"),
          ).toBe(0);
        },
      );
    } finally {
      fetch.mockRestore();
    }
  });
  it("recovers expired daily periods across pages without duplicate rewards or bot tasks", async () => {
    const period = Date.now() - 10 * 86400000;
    await withRuntime(test.env, async () => {
      const configuration = structuredClone(BASE_CONFIGURATION);
      configuration.dailyLeaderboards.enabled = true;
      configuration.dailyLeaderboards.xpRewardBrackets = [
        { minRank: 1, maxRank: 21, maxReward: 100, minReward: 10 },
      ];
      configuration.users.inbox.enabled = true;
      runtime().configuration = configuration;
      const modeRule = {
        language: "english",
        mode: "time",
        mode2: "15",
      } as const;
      for (let i = 0; i < 21; i++) {
        const uid = `payout${i}`;
        await seedUser(test.env, uid);
        await statement(
          "INSERT INTO daily_entries(board,period,uid,score,expires_at,data) VALUES('english:time:15',?,?,?,?,?)",
          period,
          uid,
          100 - i,
          period + 86400000,
          JSON.stringify({
            uid,
            name: uid,
            wpm: 100 - i,
            raw: 100,
            acc: 100,
            consistency: 100,
            timestamp: period,
          }),
        ).run();
      }
      expect(
        (
          await new DailyLeaderboard(modeRule, period).getResults(
            0,
            30,
            configuration.dailyLeaderboards,
            false,
          )
        )?.entries,
      ).toHaveLength(0);
      const task = {
        taskName: "daily-leaderboard-results",
        ctx: { yesterdayTimestamp: period, modeRule },
      } as const;
      // Persisted tasks for removed clients must never pay out web rewards.
      const retiredTask = structuredClone(task);
      Reflect.set(retiredTask.ctx, "client", "tui");
      await jobHandler(retiredTask);
      expect(
        await statement(
          "SELECT count(*) AS count FROM outbox WHERE type='reward' AND uid LIKE 'payout%'",
        ).first("count"),
      ).toBe(0);
      await jobHandler(task);
      await jobHandler(task);
      await jobHandler({ ...task, ctx: { ...task.ctx, offset: 20 } });
      expect(
        await statement(
          "SELECT count(*) AS count FROM outbox WHERE type='reward' AND uid LIKE 'payout%' ",
        ).first("count"),
      ).toBe(21);
      expect(
        await statement(
          "SELECT count(*) AS count FROM outbox WHERE type<>'reward'",
        ).first("count"),
      ).toBe(0);
      expect(
        await statement(
          "SELECT count(*) AS count FROM scheduled_jobs WHERE id=?",
          `daily:${period}:english:time:15:20`,
        ).first("count"),
      ).toBe(1);
    });
  });
  it("pays the default daily rewards only once the inbox is enabled", async () => {
    const period = Date.now() - 86400000;
    await withRuntime(test.env, async () => {
      const configuration = structuredClone(BASE_CONFIGURATION);
      runtime().configuration = configuration;
      const modeRule = {
        language: "english",
        mode: "time",
        mode2: "60",
      } as const;
      for (let i = 0; i < 3; i++) {
        const uid = `default${i}`;
        await seedUser(test.env, uid);
        await statement(
          "INSERT INTO daily_entries(board,period,uid,score,expires_at,data) VALUES('english:time:60',?,?,?,?,?)",
          period,
          uid,
          100 - i,
          period + 2 * 86400000,
          JSON.stringify({
            uid,
            name: uid,
            wpm: 100 - i,
            raw: 100,
            acc: 100,
            consistency: 100,
            timestamp: period,
          }),
        ).run();
      }
      const task = {
        taskName: "daily-leaderboard-results",
        ctx: { yesterdayTimestamp: period, modeRule },
      } as const;
      const rewards = async (): Promise<Record<string, number>> => {
        const rows = await statement(
          "SELECT uid,data FROM outbox WHERE type='reward' AND uid LIKE 'default%'",
        ).all<{ uid: string; data: string }>();
        return Object.fromEntries(
          rows.results.map(({ uid, data }) => [
            uid,
            (
              JSON.parse(data) as {
                mail: { rewards: { item: number }[] }[];
              }
            ).mail[0]?.rewards[0]?.item ?? 0,
          ]),
        );
      };

      await jobHandler(task);
      expect(await rewards()).toEqual({});

      configuration.users.inbox = { enabled: true, maxMail: 10 };
      await jobHandler(task);
      expect(await rewards()).toEqual({
        default0: 5000,
        default1: 2500,
        default2: 2313,
      });
    });
  });
});
