import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { fromCrossJSON, toJSONAsync, type SerovalNode } from "seroval";
import objectHash from "object-hash";
import { z } from "zod";
import type { CompletedEvent } from "@oxytype/schemas/results";
import { AddResultResponseSchema } from "@oxytype/contracts/results";
import { GetUserResponseSchema } from "@oxytype/contracts/users";
import { scoreEvent } from "../../../backend/__tests__/d1/result-support";
import { createWorkerd, enableConfiguration, seedSession } from "./workerd";
import { rpcPath } from "./rpc";

const outcome = z.discriminatedUnion("ok", [
  AddResultResponseSchema.extend({
    ok: z.literal(true),
    status: z.literal(200),
  }),
  z.object({ ok: z.literal(false), status: z.number(), message: z.string() }),
]);

describe("result server function in the built Worker with real D1", () => {
  let mf: Awaited<ReturnType<typeof createWorkerd>>;
  let index = 0;
  type RpcResponse = Awaited<
    ReturnType<Awaited<ReturnType<typeof mf.getWorker>>["fetch"]>
  >;
  beforeAll(async () => {
    mf = await createWorkerd();
    for (const [path, value] of [
      ["$.results", { savingEnabled: true, objectHashCheckEnabled: true }],
      ["$.users.xp.enabled", true],
      ["$.users.inbox", { enabled: true, maxMail: 100 }],
      ["$.dailyLeaderboards.enabled", true],
      ["$.leaderboards.minTimeTyping", 0],
      ["$.leaderboards.weeklyXp.enabled", true],
    ] as const) {
      await enableConfiguration(mf, "a", path, value);
    }
  });
  afterAll(async () => await mf?.dispose());

  async function account(): Promise<Awaited<ReturnType<typeof seedSession>>> {
    const session = await seedSession(mf, "a");
    const db = await mf.getD1Database("DB", "a");
    const name = `Submission${index++}`;
    const data = {
      _id: crypto.randomUUID().replaceAll("-", "").slice(0, 24),
      uid: session.uid,
      name,
      email: `${name}@example.test`,
      addedAt: 0,
      personalBests: { time: {}, words: {}, quote: {}, zen: {}, custom: {} },
      testActivity: {},
      timeTyping: 1,
    };
    await db
      .prepare(
        "INSERT INTO users(uid,id,name,name_key,email,added_at,time_typing,data) VALUES(?,?,?,?,?,0,1,?)",
      )
      .bind(
        session.uid,
        data._id,
        name,
        name.toLowerCase(),
        data.email,
        JSON.stringify(data),
      )
      .run();
    return session;
  }

  function event(
    uid: string,
    changes: Partial<CompletedEvent> = {},
  ): CompletedEvent {
    const { hash: _hash, ...data } = scoreEvent(uid, 80, index, changes);
    return { ...data, hash: objectHash(data) };
  }

  async function call(
    token: string,
    result: unknown,
    headers: Record<string, string> = {},
  ): Promise<RpcResponse> {
    const worker = await mf.getWorker("a");
    return await worker.fetch(`http://localhost:3000${rpcPath("resultsAdd")}`, {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "x-tsr-serverFn": "true",
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...headers,
      },
      body: JSON.stringify(await toJSONAsync({ data: { body: { result } } })),
    });
  }

  async function read(response: RpcResponse): Promise<z.infer<typeof outcome>> {
    const text = await response.text();
    const decoded = fromCrossJSON(JSON.parse(text), { refs: new Map() });
    return z.object({ result: outcome }).parse(decoded).result;
  }

  async function rows(uid: string, table = "results"): Promise<number | null> {
    const db = await mf.getD1Database("DB", "a");
    return await db
      .prepare(`SELECT count(*) AS n FROM ${table} WHERE uid=?`)
      .bind(uid)
      .first<number>("n");
  }

  it("validates sparse account calendars with the same JSON semantics as the former HTTP response", async () => {
    const session = await account();
    const db = await mf.getD1Database("DB", "a");
    const year = new Date().getUTCFullYear();
    await db
      .prepare(
        "UPDATE users SET data=json_set(data,'$.testActivity',json(?),'$.personalBests',json(?)) WHERE uid=?",
      )
      .bind(
        JSON.stringify({ [year - 1]: [1], [year]: [2] }),
        JSON.stringify({ time: {} }),
        session.uid,
      )
      .run();
    const worker = await mf.getWorker("a");
    const payload = encodeURIComponent(
      JSON.stringify(await toJSONAsync({ data: { query: { client: "web" } } })),
    );
    const response = await worker.fetch(
      `http://localhost:3000${rpcPath("usersGet")}?payload=${payload}`,
      {
        headers: {
          origin: "http://localhost:3000",
          "x-tsr-serverFn": "true",
          authorization: `Bearer ${session.token}`,
        },
      },
    );
    expect(response.status, await response.clone().text()).toBe(200);
    const decoded = fromCrossJSON((await response.json()) as SerovalNode, {
      refs: new Map(),
    });
    const profile = z.object({ result: GetUserResponseSchema }).parse(decoded)
      .result.data;
    expect(profile.testActivity?.testsByDays).toContain(null);
    expect(profile.testActivity?.testsByDays.at(-1)).toBe(2);
    expect(profile.personalBests).toEqual({
      time: {},
      words: {},
      quote: {},
      zen: {},
      custom: {},
    });
  });

  it("persists one result with PB, XP, activity, streak and leaderboard acknowledgements", async () => {
    const session = await account();
    const response = await call(session.token, event(session.uid));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const saved = await read(response);
    expect(saved.ok).toBe(true);
    if (!saved.ok) throw new Error(saved.message);
    expect(saved.data).toMatchObject({
      isPb: true,
      streak: 1,
      dailyLeaderboardRank: 1,
      weeklyXpLeaderboardRank: 1,
    });
    expect(saved.data.xp).toBeGreaterThan(0);
    expect(saved.data.insertedId).toMatch(/^[a-f0-9]{24}$/);
    for (const table of [
      "results",
      "daily_entries",
      "weekly_entries",
      "user_activity",
      "leaderboard_bests",
    ]) {
      expect(await rows(session.uid, table)).toBe(1);
    }
    const db = await mf.getD1Database("DB", "a");
    const profile = await db
      .prepare("SELECT completed_tests,xp,data FROM users WHERE uid=?")
      .bind(session.uid)
      .first<{ completed_tests: number; xp: number; data: string }>();
    expect(profile).toMatchObject({ completed_tests: 1, xp: saved.data.xp });
    expect(JSON.parse(profile?.data ?? "{}")).toMatchObject({
      personalBests: { time: { "15": [{ wpm: 80 }] } },
      streak: { length: 1 },
    });
  });

  it("deduplicates a lost acknowledgement/retry without granting progression twice", async () => {
    const session = await account();
    const result = event(session.uid);
    const lost = await call(session.token, result);
    expect(lost.status).toBe(200);
    await lost.body?.cancel();
    const duplicate = await call(session.token, result);
    expect(duplicate.status).toBe(466);
    expect(await read(duplicate)).toMatchObject({
      ok: false,
      status: 466,
      message: "Duplicate result",
    });
    expect(await rows(session.uid)).toBe(1);
    const db = await mf.getD1Database("DB", "a");
    expect(
      await db
        .prepare("SELECT completed_tests FROM users WHERE uid=?")
        .bind(session.uid)
        .first("completed_tests"),
    ).toBe(1);
  });

  it("serializes concurrent duplicate submissions into one accepted write", async () => {
    const session = await account();
    const result = event(session.uid);
    const responses = await Promise.all([
      call(session.token, result),
      call(session.token, result),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 466,
    ]);
    expect(await rows(session.uid)).toBe(1);
    expect(await rows(session.uid, "user_activity")).toBe(1);
  });

  it("uses the authenticated identity and rejects another user's hashed payload", async () => {
    const actor = await account();
    const target = await account();
    const response = await call(actor.token, event(target.uid));
    expect(response.status).toBe(461);
    expect(await rows(actor.uid)).toBe(0);
    expect(await rows(target.uid)).toBe(0);
    expect((await call(target.token, event(target.uid))).status).toBe(200);
  });

  it.each([
    ["schema", { mode: "unknown" }, 422],
    ["hash", { hash: "forged" }, 461],
    ["telemetry", { charTotal: 1 }, 463],
  ] as const)(
    "rejects invalid %s before any progression",
    async (_name, changes, status) => {
      const session = await account();
      const result = event(session.uid, changes as Partial<CompletedEvent>);
      if ("hash" in changes) result.hash = changes.hash;
      const response = await call(session.token, result);
      expect(response.status).toBe(status);
      for (const table of [
        "results",
        "daily_entries",
        "weekly_entries",
        "reward_grants",
        "outbox",
      ]) {
        expect(await rows(session.uid, table)).toBe(0);
      }
    },
  );

  it("retains CSRF, auth, configuration, rate and body-size gates on direct calls", async () => {
    const session = await account();
    const result = event(session.uid);
    expect(
      (await call(session.token, result, { origin: "https://foreign.example" }))
        .status,
    ).toBe(403);
    expect((await call("expired", result)).status).toBe(401);
    await enableConfiguration(mf, "a", "$.results.savingEnabled", false);
    expect((await call(session.token, result)).status).toBe(503);
    await enableConfiguration(mf, "a", "$.results.savingEnabled", true);
    expect((await call(session.token, "x".repeat(102_401))).status).toBe(413);
    const db = await mf.getD1Database("DB", "a");
    await db
      .prepare(
        "INSERT OR REPLACE INTO rate_counters(key,points,expires_at) VALUES('rate:root:192.0.2.196',1000,?)",
      )
      .bind(Date.now() + 60_000)
      .run();
    const limited = await call(session.token, result, {
      "cf-connecting-ip": "192.0.2.196",
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).not.toBeNull();
    expect(await rows(session.uid)).toBe(0);
  });

  it("rolls back all persistence if telemetry storage fails and permits a clean retry", async () => {
    const session = await account();
    const result = event(session.uid);
    await enableConfiguration(mf, "a", "$.anticheat.review", {
      enabled: true,
      minWpm: 0,
    });
    await enableConfiguration(mf, "a", "$.anticheat.samples", {
      captureFlagged: true,
      randomRate: 1,
    });
    const db = await mf.getD1Database("DB", "a");
    await db.exec(
      "CREATE TRIGGER reject_sample BEFORE INSERT ON audit_logs WHEN NEW.event='anticheat_sample' BEGIN SELECT RAISE(ABORT,'fixture telemetry failure'); END",
    );
    try {
      const failed = await call(session.token, result);
      expect(failed.status).toBe(500);
      expect(await failed.text()).not.toContain("fixture telemetry failure");
      for (const table of [
        "results",
        "daily_entries",
        "weekly_entries",
        "user_activity",
        "outbox",
      ]) {
        expect(await rows(session.uid, table)).toBe(0);
      }
    } finally {
      await db.exec("DROP TRIGGER reject_sample");
    }
    expect((await call(session.token, result)).status).toBe(200);
    expect(await rows(session.uid)).toBe(1);
  });
});
