import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { createTestRuntime, seedUser } from "./helpers";
import { preferReplicas, runtime, withRuntime } from "../../src/runtime/env";
import { binding, database, statement } from "../../src/db/client";
import { atomicUser, mutateUser } from "../../src/db/mutation";
import { getAuth } from "../../src/init/auth";

describe("D1 invocation sessions", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime();
    test.env.BETTER_AUTH_URL = "http://localhost:3000/api/auth";
  });
  afterAll(async () => await test?.dispose());

  it("shares a fresh primary-first session across Drizzle, raw SQL and batches", async () => {
    // Miniflare's RPC proxy cannot be spied on directly.
    const start = vi.fn((constraint?: string) =>
      test.env.DB.withSession(constraint),
    );
    const env = {
      ...test.env,
      DB: new Proxy(test.env.DB, {
        get(target, key): unknown {
          return key === "withSession" ? start : Reflect.get(target, key);
        },
      }),
    };
    try {
      await withRuntime(env, async () => {
        expect(start).not.toHaveBeenCalled();
        expect(binding() === runtime().session).toBe(true);
        expect(start).toHaveBeenCalledTimes(1);
        expect(start).toHaveBeenLastCalledWith("first-primary");
        expect(database().$client === binding()).toBe(true);
        await statement(
          "INSERT INTO write_receipts(id,created_at) VALUES('session',1)",
        ).run();
        expect(
          await database().get(
            sql`SELECT created_at AS points FROM write_receipts WHERE id='session'`,
          ),
        ).toEqual({ points: 1 });
        await binding().batch([
          statement(
            "UPDATE write_receipts SET created_at=2 WHERE id='session'",
          ),
        ]);
        expect(
          await statement(
            "SELECT created_at AS points FROM write_receipts WHERE id='session'",
          ).first("points"),
        ).toBe(2);
        // Drizzle, raw SQL and batched statements all count.
        expect(runtime().metrics.d1Statements).toBe(4);
      });
    } finally {
      start.mockRestore();
    }
  });

  it("opens replica-first sessions only before first use", async () => {
    const start = vi.fn((constraint?: string) =>
      test.env.DB.withSession(constraint),
    );
    const env = {
      ...test.env,
      DB: new Proxy(test.env.DB, {
        get(target, key): unknown {
          return key === "withSession" ? start : Reflect.get(target, key);
        },
      }),
    };
    await withRuntime(env, async () => {
      preferReplicas();
      expect(await statement("SELECT 1 AS one").first("one")).toBe(1);
    });
    expect(start).toHaveBeenLastCalledWith("first-unconstrained");
    await withRuntime(env, async () => {
      await statement("SELECT 1").first();
      preferReplicas();
      await statement("SELECT 1").first();
    });
    expect(start).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenLastCalledWith("first-primary");
  });

  it("isolates concurrent and nested invocation sessions", async () => {
    const sessions = await Promise.all(
      [1, 2, 3].map(
        async () =>
          await withRuntime(test.env, async () => {
            const outer = binding();
            await withRuntime(test.env, async () => {
              expect(binding() === outer).toBe(false);
              await statement("SELECT 1").first();
            });
            expect(binding() === outer).toBe(true);
            return outer;
          }),
      ),
    );
    expect(new Set(sessions).size).toBe(3);
    expect(() => runtime()).toThrow("Worker runtime is not initialized");
  });

  it("reuses Better Auth per env while each invocation reads its own primary", async () => {
    const first = await withRuntime(test.env, async () => getAuth());
    const second = await withRuntime(test.env, async () => {
      const auth = getAuth();
      // The shared instance queries this invocation's database.
      expect(
        await (await auth.$context).internalAdapter.findSession("missing"),
      ).toBeNull();
      return auth;
    });
    expect(second).toBe(first);
    const other = await withRuntime({ ...test.env }, async () => getAuth());
    expect(other).not.toBe(first);
  });

  it("keeps auth on the primary even after application reads", async () => {
    await withRuntime(test.env, async () => {
      await statement("SELECT 1").first();
      const replicaRead = vi
        .spyOn(database(), "select")
        .mockImplementation(() => {
          throw new Error("Auth must not read replicas");
        });
      try {
        const context = await getAuth().$context;
        const user = await context.internalAdapter.createUser(
          {
            name: "Replica",
            email: "replica@example.test",
            emailVerified: true,
          },
          { method: "oauth", oauth: { providerId: "github" } },
        );
        const session = await context.internalAdapter.createSession(
          user.id,
          false,
        );
        if (session === null) throw new Error("Missing fixture session");
        expect(
          await context.internalAdapter.findSession(session.token),
        ).not.toBeNull();
        await context.internalAdapter.deleteSession(session.token);
        expect(
          await context.internalAdapter.findSession(session.token),
        ).toBeNull();
      } finally {
        replicaRead.mockRestore();
      }
    });
  });

  it("retries version conflicts using primary snapshots rather than lagging reads", async () => {
    await seedUser(test.env, "session-retry");
    await withRuntime(test.env, async () => {
      const replicaRead = vi
        .spyOn(database(), "select")
        .mockImplementation(() => {
          throw new Error("Mutation snapshots must not read replicas");
        });
      let attempts = 0;
      try {
        await atomicUser("session-retry", async () => {
          attempts++;
          await mutateUser("session-retry", (user) => {
            user.xp = (user.xp ?? 0) + 5;
          });
          if (attempts === 1) {
            await test.env.DB.prepare(
              "UPDATE users SET version=version+1 WHERE uid='session-retry'",
            ).run();
          }
        });
      } finally {
        replicaRead.mockRestore();
      }
      expect(attempts).toBe(2);
      expect(
        await statement("SELECT xp FROM users WHERE uid='session-retry'").first(
          "xp",
        ),
      ).toBe(5);
    });
  });
});
