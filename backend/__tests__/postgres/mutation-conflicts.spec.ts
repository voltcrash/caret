import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";
import { withRuntime } from "../../src/runtime/env";
import { atomicUser, atomicUserWithReads, stage } from "../../src/db/mutation";
import { statement } from "../../src/db/client";
import * as Users from "../../src/dal/user";

describe("PostgreSQL optimistic version guards", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime();
  });
  afterAll(async () => await test?.dispose());

  it("exhausts eight conflicts without leaving staged writes or partial user updates", async () => {
    await seedUser(test.env, "exhaust");
    await withRuntime(test.env, async () => {
      let attempts = 0;
      await expect(
        atomicUser("exhaust", async () => {
          attempts++;
          await Users.incrementXp("exhaust", 100);
          await stage(
            statement(
              "INSERT INTO write_receipts(id,created_at) VALUES(?,0)",
              `exhaust${attempts}`,
            ),
          );
          await statement(
            "UPDATE users SET version=version+1 WHERE uid='exhaust'",
          ).run();
        }),
      ).rejects.toMatchObject({
        status: 409,
        message: "Concurrent update; please retry",
      });
      expect(attempts).toBe(8);
      expect((await Users.getUser("exhaust", "test")).xp).toBeUndefined();
      expect(
        await statement(
          "SELECT count(*) AS n FROM write_receipts WHERE id LIKE 'exhaust%'",
        ).first("n"),
      ).toBe(0);
      expect(
        await statement("SELECT count(*) AS n FROM mutation_guards").first("n"),
      ).toBe(0);
    });
  });

  it("returns reads appended to the committing batch, after its writes", async () => {
    await seedUser(test.env, "batched-read");
    await withRuntime(test.env, async () => {
      const { result, reads } = await atomicUserWithReads(
        "batched-read",
        async () => {
          await Users.incrementXp("batched-read", 40);
          return "done";
        },
        (outcome) => {
          expect(outcome).toBe("done");
          return [
            statement("SELECT xp FROM users WHERE uid=?", "batched-read"),
          ];
        },
      );
      expect(result).toBe("done");
      expect(reads?.map((read) => read.results)).toEqual([[{ xp: 40 }]]);
    });
  });

  it("retries a stale snapshot and commits its progression and staged writes only once", async () => {
    await seedUser(test.env, "retry");
    await withRuntime(test.env, async () => {
      let attempts = 0;
      const returned = await atomicUser("retry", async () => {
        attempts++;
        await Users.incrementXp("retry", 25);
        await Users.updateTypingStats("retry", 2, 30);
        await stage(
          statement(
            "INSERT INTO write_receipts(id,created_at) VALUES(?,0)",
            `attempt${attempts}`,
          ),
        );
        // A separate PostgreSQL write commits after the snapshot, before the guarded batch.
        if (attempts === 1) {
          await statement(
            "UPDATE users SET version=version+1 WHERE uid='retry'",
          ).run();
        }
        return attempts;
      });
      expect(attempts).toBe(2);
      expect(returned).toBe(2);
      expect(await Users.getStats("retry")).toEqual({
        completedTests: 1,
        startedTests: 3,
        timeTyping: 30,
      });
      expect((await Users.getUser("retry", "test")).xp).toBe(25);
      expect(
        (
          await statement(
            "SELECT id FROM write_receipts WHERE id LIKE 'attempt%' ORDER BY id",
          ).all<{ id: string }>()
        ).results,
      ).toEqual([{ id: "attempt2" }]);
      expect(
        await statement("SELECT count(*) AS n FROM mutation_guards").first("n"),
      ).toBe(0);
      expect(
        await statement("SELECT version FROM users WHERE uid='retry'").first(
          "version",
        ),
      ).toBe(2);
    });
  });
});
