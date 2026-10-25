import type { D1PreparedStatement } from "@cloudflare/workers-types";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createTestRuntime, seedUser } from "./helpers";
import { runtime, withRuntime } from "../../src/runtime/env";
import { statement } from "../../src/db/client";
import { commitBatch } from "../../src/db/commit";
import { atomicUser, mutateUser, stage } from "../../src/db/mutation";
import { MAINTENANCE_CRON, scheduled } from "../../src/runtime/tasks";

describe("receipt-protected D1 commits", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime();
  });
  afterAll(async () => await test?.dispose());

  it.each(["before", "after"])(
    "does not double-apply progression when the connection fails %s commit",
    async (failure) => {
      const uid = `retry-${failure}`;
      await seedUser(test.env, uid);
      await withRuntime(test.env, async () => {
        const scope = runtime();
        const session = scope.session;
        let batches = 0;
        scope.session = {
          prepare: (query) => session.prepare(query),
          getBookmark: () => session.getBookmark(),
          batch: async <T = unknown>(queries: D1PreparedStatement[]) => {
            batches++;
            if (batches === 1 && failure === "before") {
              throw new Error("Network connection lost");
            }
            const result = await session.batch<T>(queries);
            if (batches === 1 && failure === "after") {
              throw new Error("Network connection lost");
            }
            return result;
          },
        };
        let callbacks = 0;
        const result = await atomicUser(uid, async () => {
          callbacks++;
          await mutateUser(uid, (user) => {
            user.xp = (user.xp ?? 0) + 25;
          });
          await stage(
            statement(
              "INSERT INTO public_stats(id,tests_completed) VALUES(?,1)",
              uid,
            ),
          );
          return "saved";
        });
        expect(result).toBe("saved");
        expect(callbacks).toBe(1);
        expect(batches).toBe(failure === "before" ? 2 : 1);
        expect(
          await statement(
            "SELECT xp,version FROM users WHERE uid=?",
            uid,
          ).first(),
        ).toEqual({ xp: 25, version: 1 });
        expect(
          await statement(
            "SELECT tests_completed FROM public_stats WHERE id=?",
            uid,
          ).first("tests_completed"),
        ).toBe(1);
        expect(
          await statement("SELECT count(*) AS n FROM mutation_guards").first(
            "n",
          ),
        ).toBe(0);
      });
    },
  );

  it("rolls back receipts together with failed effects", async () => {
    await withRuntime(test.env, async () => {
      const before = await statement(
        "SELECT count(*) AS n FROM write_receipts",
      ).first("n");
      await expect(
        commitBatch([
          statement("INSERT INTO public_stats(id) VALUES('rolled-back-retry')"),
          statement(
            "INSERT INTO mutation_guards(id,valid) VALUES('invalid-retry',0)",
          ),
        ]),
      ).rejects.toThrow("mutation_version");
      expect(
        await statement("SELECT count(*) AS n FROM write_receipts").first("n"),
      ).toBe(before);
      expect(
        await statement(
          "SELECT id FROM public_stats WHERE id='rolled-back-retry'",
        ).first(),
      ).toBeNull();
    });
  });

  it("handles an original commit arriving after an initially empty recovery probe", async () => {
    await seedUser(test.env, "delayed-commit");
    await withRuntime(test.env, async () => {
      const session = runtime().session;
      let pending: D1PreparedStatement[] | undefined;
      let batches = 0;
      runtime().session = {
        prepare: (query) => session.prepare(query),
        getBookmark: () => session.getBookmark(),
        batch: async <T = unknown>(queries: D1PreparedStatement[]) => {
          batches++;
          if (batches === 1) {
            pending = queries;
            throw new Error("Network connection lost");
          }
          if (pending !== undefined) {
            await session.batch(pending);
            pending = undefined;
          }
          return await session.batch<T>(queries);
        },
      };
      let callbacks = 0;
      await atomicUser("delayed-commit", async () => {
        callbacks++;
        await mutateUser("delayed-commit", (user) => {
          user.xp = (user.xp ?? 0) + 25;
        });
      });
      expect(callbacks).toBe(1);
      expect(batches).toBe(2);
      expect(
        await statement(
          "SELECT xp,version FROM users WHERE uid='delayed-commit'",
        ).first(),
      ).toEqual({ xp: 25, version: 1 });
    });
  });

  it("stops after four failed batch attempts without repeating callbacks or effects", async () => {
    await seedUser(test.env, "retry-exhausted");
    await withRuntime(test.env, async () => {
      const session = runtime().session;
      let batches = 0;
      runtime().session = {
        prepare: (query) => session.prepare(query),
        getBookmark: () => session.getBookmark(),
        batch: async () => {
          batches++;
          throw new Error("Network connection lost");
        },
      };
      let callbacks = 0;
      await expect(
        atomicUser("retry-exhausted", async () => {
          callbacks++;
          await mutateUser("retry-exhausted", (user) => {
            user.xp = 25;
          });
        }),
      ).rejects.toThrow("Network connection lost");
      expect(callbacks).toBe(1);
      expect(batches).toBe(4);
      expect(
        await statement(
          "SELECT xp,version FROM users WHERE uid='retry-exhausted'",
        ).first(),
      ).toEqual({ xp: 0, version: 0 });
    });
  });

  it("purges expired receipts while retaining recent commits", async () => {
    await test.env.DB.prepare(
      "INSERT INTO write_receipts(id,created_at) VALUES('expired-receipt',0)",
    ).run();
    await withRuntime(test.env, async () => {
      await commitBatch([
        statement("INSERT INTO public_stats(id) VALUES('recent-receipt')"),
      ]);
      await scheduled(MAINTENANCE_CRON);
      expect(
        await statement(
          "SELECT id FROM write_receipts WHERE id='expired-receipt'",
        ).first(),
      ).toBeNull();
      expect(
        await statement(
          "SELECT count(*) AS n FROM write_receipts",
        ).first<number>("n"),
      ).toBeGreaterThan(0);
    });
  });
});
