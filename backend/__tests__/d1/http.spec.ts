import objectHash from "object-hash";
import * as Results from "../../src/dal/result";
import { statement } from "../../src/db/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { createTestRuntime } from "./helpers";
import { withRuntime } from "../../src/runtime/env";
import { getAuth } from "../../src/init/auth";
import * as Users from "../../src/dal/user";
import { patchConfiguration } from "../../src/init/configuration";
import Worker from "../__testData__/http-worker";
import { GetUserResponseSchema } from "@caret/contracts/users";
import type { ExecutionContext } from "@cloudflare/workers-types";

describe("Worker HTTP with D1", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  let token: string;
  let uid: string;
  const context = { waitUntil: () => undefined } as unknown as ExecutionContext;
  beforeAll(async () => {
    test = await createTestRuntime();
    test.env.BETTER_AUTH_URL = "http://localhost:5005/api/auth";
    await withRuntime(test.env, async () => {
      const auth = await getAuth().$context;
      const user = await auth.internalAdapter.createUser(
        { name: "Http", email: "http@example.com", emailVerified: true },
        { method: "oauth", oauth: { providerId: "google" } },
      );
      uid = user.id;
      const session = await auth.internalAdapter.createSession(uid, false);
      if (session === null) throw new Error("Missing session");
      token = session.token;
      await Users.addUser("Http", user.email, uid);
      await test.env.DB.prepare(
        "UPDATE users SET added_at=0,data=json_set(data,'$.addedAt',0) WHERE uid=?",
      )
        .bind(uid)
        .run();
    });
  });
  afterAll(async () => await test.dispose());
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
  ): Promise<Response> {
    return await Worker.fetch(
      new Request(`http://localhost:5005/api${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      test.env,
      context,
    );
  }
  it("lets only edge-cached public reads start on a replica", async () => {
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
    const fetch = async (path: string): Promise<number> =>
      (
        await Worker.fetch(
          new Request(`http://localhost:5005/api${path}`, {
            headers: {
              authorization: `Bearer ${token}`,
              origin: "http://localhost:3000",
            },
          }),
          env,
          context,
        )
      ).status;
    expect(await fetch("/public/typingStats")).toBe(200);
    expect(start).toHaveBeenLastCalledWith("first-unconstrained");
    expect(await fetch("/users")).toBe(200);
    expect(start).toHaveBeenLastCalledWith("first-primary");
  });
  it("routes /api and serves the schema-valid signed-in user", async () => {
    expect((await request("/")).status).toBe(200);
    const response = await request("/users");
    expect(response.status).toBe(200);
    expect(GetUserResponseSchema.parse(await response.json()).data.uid).toBe(
      uid,
    );
  });
  it("retries a full result save from the original hashed payload without duplicating progression", async () => {
    await withRuntime(test.env, async () => {
      await patchConfiguration({
        results: { savingEnabled: true, objectHashCheckEnabled: true },
        users: { xp: { enabled: true, funboxBonus: 1 } },
      });
    });
    const result = {
      acc: 86,
      afkDuration: 5,
      bailedOut: false,
      blindMode: false,
      charStats: [100, 2, 3, 5],
      chartData: { wpm: [1, 2, 3], burst: [50, 55, 56], err: [0, 2, 0] },
      consistency: 95.11,
      difficulty: "normal",
      funbox: [],
      incompleteTestSeconds: 10,
      incompleteTests: [2, 2, 2, 4].map((seconds) => ({ acc: 75, seconds })),
      keyConsistency: 8.9,
      keyDuration: [0, 3, 5, 7],
      keySpacing: [0, 2, 4],
      language: "english",
      lazyMode: false,
      mode: "time",
      mode2: "15",
      numbers: false,
      punctuation: false,
      rawWpm: 99.34,
      restartCount: 4,
      tags: [],
      testDuration: 15.1,
      timestamp: 1000,
      uid,
      wpmConsistency: 59.2,
      wpm: 79.47,
      stopOnLetter: false,
      charTotal: 125,
      keyOverlap: 7,
      lastKeyToEnd: 15083,
      startToFirstKey: 11,
    };
    const original = Results.addResult;
    let conflict = true;
    const save = vi
      .spyOn(Results, "addResult")
      .mockImplementation(async (...args) => {
        if (conflict) {
          conflict = false;
          // Simulate a committed concurrent update between snapshot and commit.
          await statement(
            "UPDATE users SET version=version+1 WHERE uid=?",
            uid,
          ).run();
        }
        return await original(...args);
      });
    try {
      const response = await request("/results", "POST", {
        result: { ...result, hash: objectHash(result) },
      });
      const body: unknown = await response.json();
      expect(response.status, JSON.stringify(body)).toBe(200);
      expect(save).toHaveBeenCalledTimes(2);
      await withRuntime(test.env, async () => {
        expect(
          await statement(
            "SELECT count(*) AS count FROM results WHERE uid=?",
            uid,
          ).first("count"),
        ).toBe(1);
        expect((await Users.getUser(uid, "test")).completedTests).toBe(1);
        expect(
          await statement(
            "SELECT tests_completed FROM public_stats WHERE id='stats'",
          ).first("tests_completed"),
        ).toBe(1);
      });
    } finally {
      save.mockRestore();
    }
  });
  it("rejects revoked D1 sessions on subsequent requests", async () => {
    await withRuntime(test.env, async () => {
      await (await getAuth().$context).internalAdapter.deleteSession(token);
    });
    expect((await request("/users")).status).toBe(401);
  });
});
