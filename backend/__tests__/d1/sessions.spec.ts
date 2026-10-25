import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { sql } from "drizzle-orm";
import { createTestRuntime, seedUser } from "./helpers";
import { runtime, withRuntime } from "../../src/runtime/env";
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
        expect(start).toHaveBeenLastCalledWith("first-primary");
        expect(binding() === runtime().session).toBe(true);
        expect(database().$client === binding()).toBe(true);
        await statement(
          "INSERT INTO rate_counters(key,points,expires_at) VALUES('session',1,0)",
        ).run();
        expect(
          await database().get(
            sql`SELECT points FROM rate_counters WHERE key='session'`,
          ),
        ).toEqual({ points: 1 });
        await binding().batch([
          statement("UPDATE rate_counters SET points=2 WHERE key='session'"),
        ]);
        expect(
          await statement(
            "SELECT points FROM rate_counters WHERE key='session'",
          ).first("points"),
        ).toBe(2);
        // Drizzle, raw SQL and batched statements all count.
        expect(runtime().metrics.d1Statements).toBe(4);
      });
    } finally {
      start.mockRestore();
    }
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
