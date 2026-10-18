import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import objectHash from "object-hash";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { createTestRuntime } from "./helpers";
import { withRuntime } from "../../src/runtime/env";
import { getAuth } from "../../src/init/auth";
import { patchConfiguration } from "../../src/init/configuration";
import * as Users from "../../src/dal/user";
import * as Results from "../../src/dal/result";
import Worker from "../__testData__/http-worker";
import { completedEvent } from "../__testData__/completed-event";
import type { CompletedEvent } from "@oxytype/schemas/results";
import { consistency } from "../../src/anticheat/result";

describe("web and offline result submissions", () => {
  let test: Awaited<ReturnType<typeof createTestRuntime>>;
  let uid: string;
  let token: string;
  beforeAll(async () => {
    test = await createTestRuntime();
    test.env.MODE = "production";
    test.env.BETTER_AUTH_URL = "http://localhost:5005/api/auth";
    test.env.BETTER_AUTH_SECRET =
      "client-test-secret-at-least-thirty-two-characters";
    await withRuntime(test.env, async () => {
      await patchConfiguration({
        results: { savingEnabled: true, objectHashCheckEnabled: true },
        users: { xp: { enabled: true } },
        dailyLeaderboards: { enabled: true },
        leaderboards: { minTimeTyping: 0, weeklyXp: { enabled: true } },
      });
      const auth = await getAuth().$context;
      const user = await auth.internalAdapter.createUser(
        { name: "Clients", email: "clients@example.test", emailVerified: true },
        { method: "oauth", oauth: { providerId: "github" } },
      );
      uid = user.id;
      await Users.addUser(user.name, user.email, uid);
      await test.env.DB.prepare(
        "UPDATE users SET added_at=0,data=json_set(data,'$.addedAt',0) WHERE uid=?",
      )
        .bind(uid)
        .run();
      const session = await auth.internalAdapter.createSession(uid, false);
      if (session === null) throw new Error("Missing session");
      token = session.token;
      await Users.updateTypingStats(uid, 0, 31);
    });
  });
  afterAll(async () => await test?.dispose());
  async function request(path: string, body?: unknown): Promise<Response> {
    return await Worker.fetch(
      new Request(`http://localhost:5005/api${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      test.env,
      { waitUntil: () => undefined } as unknown as ExecutionContext,
    );
  }
  function event(
    changes: Partial<CompletedEvent>,
    salt: number,
  ): CompletedEvent {
    const keySpacing = Array.from(
      { length: 219 },
      (_, i) => 95 + (i % (7 + salt)) * 7,
    );
    const result = completedEvent({
      uid,
      ...changes,
      keySpacing,
      keyConsistency: consistency(keySpacing.slice(0, -1)),
      lastKeyToEnd: 30_000 - keySpacing.reduce((sum, value) => sum + value, 0),
    });
    return result;
  }
  async function submit(
    result: CompletedEvent,
    legacy = false,
  ): Promise<Response> {
    const { hash: _hash, ...payload } = result;
    const data:
      | Omit<CompletedEvent, "hash">
      | Omit<CompletedEvent, "hash" | "client"> = legacy
      ? (({ client: _client, ...rest }) => rest)(payload)
      : payload;
    return await request("/results", {
      result: { ...data, hash: objectHash(data) },
    });
  }
  it("accepts legacy web hashes without Origin", async () => {
    const response = await submit(
      event({ mode2: "30", testDuration: 30 }, 1),
      true,
    );
    expect(response.status, await response.clone().text()).toBe(200);
    const web = await request("/results");
    expect(await web.json()).toMatchObject({ data: [{ client: "web" }] });
  });
  it("saves offline history and stats without PBs, XP or leaderboard entries", async () => {
    const before = await withRuntime(
      test.env,
      async () => await Users.getUser(uid, "test", "web"),
    );
    const counts = await test.env.DB.prepare(
      "SELECT (SELECT count(*) FROM daily_entries) AS daily,(SELECT count(*) FROM weekly_entries) AS weekly",
    ).first();
    const timestamp = Date.now() - 2 * 86400000;
    const response = await submit(
      event(
        {
          client: "web",
          offline: true,
          timestamp,
          restartCount: 2,
          incompleteTestSeconds: 10,
          incompleteTests: [
            { acc: 80, seconds: 5 },
            { acc: 80, seconds: 5 },
          ],
        },
        3,
      ),
    );
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.clone().json()).toMatchObject({
      data: { isPb: false, tagPbs: [], xp: 0, dailyXpBonus: false },
    });
    const data = (await response.json()) as { data: { insertedId: string } };
    await withRuntime(test.env, async () => {
      const saved = await Results.getResult(uid, data.data.insertedId);
      expect(saved).toMatchObject({ client: "web", offline: true, timestamp });
      const after = await Users.getUser(uid, "test", "web");
      expect(after.completedTests).toBe((before.completedTests ?? 0) + 1);
      expect(after.timeTyping).toBe((before.timeTyping ?? 0) + 30);
      expect(after.xp).toBe(before.xp);
      expect(after.personalBests).toEqual(before.personalBests);
      expect(after.streak).toEqual(before.streak);
      const tag = await Users.addTag(uid, "offline");
      await Results.updateTags(uid, saved._id, [tag._id]);
      expect(
        await Users.checkIfTagPb(
          uid,
          { tags: await Users.getTags(uid) },
          { ...saved, tags: [tag._id] },
        ),
      ).toEqual([]);
    });
    expect(
      await test.env.DB.prepare(
        "SELECT (SELECT count(*) FROM daily_entries) AS daily,(SELECT count(*) FROM weekly_entries) AS weekly",
      ).first(),
    ).toEqual(counts);
  });
  it("rejects expired/future offline uploads, forged scores and duplicate saves", async () => {
    for (const timestamp of [Date.now() - 31 * 86400000, Date.now() + 60000]) {
      expect(
        (await submit(event({ client: "web", offline: true, timestamp }, 4)))
          .status,
      ).toBe(400);
    }
    expect(
      (
        await submit(
          event(
            {
              client: "web",
              offline: true,
              timestamp: Date.now() - 86400000,
              wpm: 120,
            },
            5,
          ),
        )
      ).status,
    ).toBe(463);
    const result = event(
      { client: "web", offline: true, timestamp: Date.now() - 86400000 },
      6,
    );
    expect((await submit(result)).status).toBe(200);
    expect((await submit(result)).status).toBe(466);
  });
  it.each([false, true])(
    "deduplicates lost-response offline retries (legacy hash: %s)",
    async (legacyHash) => {
      await test.env.DB.prepare(
        "UPDATE results SET timestamp=timestamp-120000 WHERE uid=?",
      )
        .bind(uid)
        .run();
      const result = event(
        { timestamp: Date.now(), offline: false },
        legacyHash ? 5 : 4,
      );
      const response = await submit(result);
      expect(response.status, await response.clone().text()).toBe(200);
      const { data } = (await response.json()) as {
        data: { insertedId: string };
      };
      if (legacyHash) {
        const { hash: _hash, ...payload } = result;
        await test.env.DB.prepare(
          "UPDATE results SET submission_hash=? WHERE id=?",
        )
          .bind(objectHash(payload), data.insertedId)
          .run();
      }
      const before = await withRuntime(
        test.env,
        async () => await Users.getUser(uid, "before retry", "web"),
      );
      const count = await test.env.DB.prepare(
        "SELECT count(*) AS n FROM results WHERE uid=?",
      )
        .bind(uid)
        .first("n");
      const retry = await submit({ ...result, offline: true });
      expect(retry.status, await retry.clone().text()).toBe(466);
      expect(
        await test.env.DB.prepare(
          "SELECT count(*) AS n FROM results WHERE uid=?",
        )
          .bind(uid)
          .first("n"),
      ).toBe(count);
      const after = await withRuntime(
        test.env,
        async () => await Users.getUser(uid, "after retry", "web"),
      );
      for (const field of [
        "completedTests",
        "startedTests",
        "timeTyping",
        "xp",
        "personalBests",
        "testActivity",
      ] as const) {
        expect(after[field]).toEqual(before[field]);
      }
    },
  );
});
