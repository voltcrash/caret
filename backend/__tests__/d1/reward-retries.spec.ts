import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";
import { withRuntime, type WorkerEnv } from "../../src/runtime/env";
import { statement } from "../../src/db/client";
import { atomicUser } from "../../src/db/mutation";
import { MonkeyQueue } from "../../src/queues/monkey-queue";
import { dispatch, __testing } from "../../src/runtime/tasks";
import * as Users from "../../src/dal/user";
import type { MonkeyMail } from "@oxytype/schemas/users";

describe("D1 reward delivery retries", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime();
  });
  afterAll(async () => await test?.dispose());

  it("keeps failed publications pending and republishes after the delivery lease expires", async () => {
    const sendBatch = vi
      .fn(
        async (
          _messages: { body: { id: string; kind: "outbox" | "job" } }[],
        ): Promise<void> => undefined,
      )
      .mockRejectedValueOnce(new Error("queue unavailable"))
      .mockResolvedValue(undefined);
    await withRuntime(
      { ...test.env, TASKS: { sendBatch } as unknown as WorkerEnv["TASKS"] },
      async () => {
        await seedUser(test.env, "publish");
        await expect(
          atomicUser("publish", async () => {
            await new MonkeyQueue("reward").add(
              "reward",
              { uid: "publish" },
              { jobId: "rolledback" },
            );
            throw new Error("cancelled save");
          }),
        ).rejects.toThrow("cancelled save");
        expect(
          await statement(
            "SELECT count(*) AS n FROM outbox WHERE id='rolledback'",
          ).first("n"),
        ).toBe(0);
        await new MonkeyQueue("reward").add(
          "reward",
          { uid: "publish" },
          { jobId: "publish" },
        );
        await expect(dispatch()).rejects.toThrow("queue unavailable");
        expect(
          await statement(
            "SELECT sent_at FROM outbox WHERE id='publish'",
          ).first("sent_at"),
        ).toBeNull();
        await dispatch();
        await dispatch();
        expect(sendBatch).toHaveBeenCalledTimes(2);
        await statement(
          "UPDATE outbox SET sent_at=? WHERE id='publish'",
          Date.now() - 900001,
        ).run();
        await dispatch();
        expect(sendBatch).toHaveBeenCalledTimes(3);
        expect(sendBatch.mock.calls.map((call) => call[0])).toEqual(
          Array.from({ length: 3 }, () => [
            { body: { id: "publish", kind: "outbox" } },
          ]),
        );
      },
    );
  });

  it("rolls back a failed inbox batch, then deduplicates redelivery and concurrent reward claims", async () => {
    await seedUser(test.env, "recipientRetry");
    await withRuntime(test.env, async () => {
      const mail: MonkeyMail = {
        id: "retryMail",
        timestamp: 1,
        read: false,
        subject: "Reward",
        body: "Earned",
        rewards: [
          { type: "xp", item: 50 },
          { type: "badge", item: { id: 14 } },
        ],
      };
      await statement(
        "INSERT INTO outbox(id,type,uid,created_at,data) VALUES('retryDelivery','reward','recipientRetry',0,?)",
        JSON.stringify({
          uid: "recipientRetry",
          // Retired-client rewards from the existing outbox must not credit web XP.
          mail: [
            {
              ...mail,
              rewards: [
                ...mail.rewards,
                { type: "xp", item: 20, client: "tui" },
              ],
            },
          ],
          inboxConfig: { enabled: true, maxMail: 100 },
        }),
      ).run();
      await statement(
        "CREATE TRIGGER reject_reward BEFORE INSERT ON inbox WHEN NEW.uid='recipientRetry' BEGIN SELECT RAISE(ABORT,'transient inbox failure'); END",
      ).run();
      await expect(
        __testing.consume({ id: "retryDelivery", kind: "outbox" }),
      ).rejects.toThrow("transient inbox failure");
      expect(await Users.getInbox("recipientRetry")).toEqual([]);
      expect(
        await statement(
          "SELECT count(*) AS n FROM reward_grants WHERE uid='recipientRetry'",
        ).first("n"),
      ).toBe(0);
      expect(
        await statement(
          "SELECT completed_at FROM outbox WHERE id='retryDelivery'",
        ).first("completed_at"),
      ).toBeNull();
      await statement("DROP TRIGGER reject_reward").run();
      await __testing.consume({ id: "retryDelivery", kind: "outbox" });
      // Lost completion acknowledgement: replay after the inbox transaction committed.
      await statement(
        "UPDATE outbox SET completed_at=NULL WHERE id='retryDelivery'",
      ).run();
      await __testing.consume({ id: "retryDelivery", kind: "outbox" });
      expect(await Users.getInbox("recipientRetry")).toHaveLength(1);
      expect((await Users.getInbox("recipientRetry"))[0]?.rewards).toEqual(
        mail.rewards,
      );
      await Promise.all([
        Users.updateInbox("recipientRetry", [mail.id], []),
        Users.updateInbox("recipientRetry", [], [mail.id]),
      ]);
      await Users.addToInbox("recipientRetry", [mail], {
        enabled: true,
        maxMail: 100,
      });
      await Users.updateInbox("recipientRetry", [mail.id], []);
      const web = await Users.getUser("recipientRetry", "test");
      expect(web.xp).toBe(50);
      expect(web.inventory?.badges).toEqual([{ id: 14 }]);
      expect(
        await statement(
          "SELECT count(*) AS n FROM reward_grants WHERE uid='recipientRetry' AND claimed=1",
        ).first("n"),
      ).toBe(1);
    });
  });
});
