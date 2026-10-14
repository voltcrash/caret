import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";
import { withRuntime, type WorkerEnv } from "../../src/runtime/env";
import { statement } from "../../src/db/client";
import { atomicUser } from "../../src/db/mutation";
import { MonkeyQueue } from "../../src/queues/monkey-queue";
import { dispatch } from "../../src/runtime/tasks";

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
});
