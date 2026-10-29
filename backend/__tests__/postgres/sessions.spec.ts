import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createTestRuntime } from "./helpers";
import { runtime, withRuntime } from "../../src/runtime/env";
import { database, statement } from "../../src/db/client";
import { getAuth } from "../../src/init/auth";

describe("Hyperdrive invocation clients", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  beforeAll(async () => {
    test = await createTestRuntime();
    test.env.BETTER_AUTH_URL = "http://localhost:3000/api/auth";
  });
  afterAll(async () => await test?.dispose());
  it("shares Drizzle and SQL within an invocation and counts statements", async () => {
    await withRuntime(test.env, async () => {
      expect(database().$client).toBe(runtime().sql);
      await statement("SELECT 1").first();
      expect(runtime().metrics.dbStatements).toBe(1);
    });
  });
  it("isolates concurrent and nested invocations", async () => {
    const clients = await Promise.all(
      [1, 2, 3].map(
        async () =>
          await withRuntime(test.env, async () => {
            const outer = runtime().sql;
            await withRuntime(test.env, async () => {
              expect(runtime().sql).not.toBe(outer);
              await statement("SELECT 1").first();
            });
            expect(runtime().sql).toBe(outer);
            return outer;
          }),
      ),
    );
    expect(new Set(clients).size).toBe(3);
    expect(() => runtime()).toThrow("Worker runtime is not initialized");
  });
  it("reuses auth while reading the current invocation's database", async () => {
    const first = await withRuntime(test.env, async () => getAuth());
    const second = await withRuntime(test.env, async () => {
      const auth = getAuth();
      expect(
        await (await auth.$context).internalAdapter.findSession("missing"),
      ).toBeNull();
      return auth;
    });
    expect(second).toBe(first);
  });
});

it("closes invocation sockets once when a streamed response is cancelled during a read", async () => {
  const test = await createTestRuntime();
  try {
    let pool: ReturnType<typeof runtime>["sql"] | undefined;
    const response = await withRuntime(test.env, async () => {
      pool = runtime().sql;
      await statement("SELECT 1").first();
      return new Response(
        new ReadableStream({
          pull() {
            /* Remain pending until cancelled. */
          },
        }),
      );
    });
    await response.body?.cancel();
    expect(pool?.totalCount).toBe(0);
  } finally {
    await test.dispose();
  }
});

it("finishes the response before background writes, keeping sockets until waitUntil settles", async () => {
  const test = await createTestRuntime();
  let release = (): void => {
    /* Assigned synchronously by the gate. */
  };
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tasks: Promise<unknown>[] = [];
  let pool: ReturnType<typeof runtime>["sql"] | undefined;
  let wrote = false;
  try {
    const response = await withRuntime(
      test.env,
      async () => {
        pool = runtime().sql;
        await statement("SELECT 1").first();
        runtime().execution?.waitUntil(
          (async () => {
            await gate;
            await statement("SELECT 1").first();
            wrote = true;
          })(),
        );
        return Response.json({ ok: true });
      },
      {
        waitUntil(task) {
          tasks.push(task);
        },
      },
    );
    let body: unknown;
    const read = response.json().then((value: unknown) => {
      body = value;
      return value;
    });
    await expect.poll(() => body).toEqual({ ok: true });
    await read;
    expect(wrote).toBe(false);
    expect(pool?.totalCount).toBeGreaterThan(0);
    release();
    await Promise.all(tasks);
    expect(wrote).toBe(true);
    expect(pool?.totalCount).toBe(0);
  } finally {
    release();
    await Promise.allSettled(tasks);
    await test.dispose();
  }
});
