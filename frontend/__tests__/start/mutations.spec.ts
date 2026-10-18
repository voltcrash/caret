import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { fromCrossJSON, toJSONAsync, type SerovalNode } from "seroval";
import { z } from "zod";
import {
  AddPresetResponseSchemna,
  GetPresetResponseSchema,
} from "@oxytype/contracts/presets";
import { GetConfigResponseSchema } from "@oxytype/contracts/configs";
import { createWorkerd, enableConfiguration, seedSession } from "./workerd";
import { rpcPath } from "./rpc";

describe("ordinary server-function mutations with real D1", () => {
  let mf: Awaited<ReturnType<typeof createWorkerd>>;
  type Session = Awaited<ReturnType<typeof seedSession>>;
  type Reply = Awaited<
    ReturnType<Awaited<ReturnType<typeof mf.getWorker>>["fetch"]>
  >;
  let index = 0;
  beforeAll(async () => {
    mf = await createWorkerd();
    await enableConfiguration(mf, "a", "$.users.inbox.enabled", true);
  });
  afterAll(async () => await mf?.dispose());

  async function account(): Promise<Session> {
    const session = await seedSession(mf, "a");
    const db = await mf.getD1Database("DB", "a");
    const name = `Mutation${index++}`;
    const data = {
      uid: session.uid,
      name,
      email: `${name}@example.test`,
      addedAt: 0,
      personalBests: { time: {}, words: {}, quote: {}, zen: {}, custom: {} },
    };
    await db
      .prepare(
        "INSERT INTO users(uid,id,name,name_key,email,added_at,data) VALUES(?,?,?,?,?,0,?)",
      )
      .bind(
        session.uid,
        session.uid,
        name,
        name.toLowerCase(),
        data.email,
        JSON.stringify(data),
      )
      .run();
    return session;
  }

  async function call(
    session: Session,
    name: string,
    method: "GET" | "POST",
    data: unknown = {},
  ): Promise<Reply> {
    const worker = await mf.getWorker("a");
    const payload = JSON.stringify(await toJSONAsync({ data }));
    return await worker.fetch(
      `http://localhost:3000${rpcPath(name)}${method === "GET" ? `?payload=${encodeURIComponent(payload)}` : ""}`,
      {
        method,
        headers: {
          origin: "http://localhost:3000",
          "x-tsr-serverFn": "true",
          "content-type": "application/json",
          authorization: `Bearer ${session.token}`,
        },
        ...(method === "POST" ? { body: payload } : {}),
      },
    );
  }

  async function result(response: Reply): Promise<unknown> {
    const decoded: unknown = fromCrossJSON(
      (await response.json()) as SerovalNode,
      { refs: new Map() },
    );
    return z.object({ result: z.unknown() }).parse(decoded).result;
  }

  it("creates, edits and deletes a preset without crossing account ownership", async () => {
    const actor = await account();
    const rival = await account();
    const created = await call(actor, "presetsAdd", "POST", {
      body: { name: "practice", config: { mode: "words", words: 10 } },
    });
    expect(created.status, await created.clone().text()).toBe(200);
    const id = AddPresetResponseSchemna.parse(await result(created)).data
      .presetId;
    const changed = await call(actor, "presetsSave", "POST", {
      body: { _id: id, name: "focused", config: { mode: "time", time: 60 } },
    });
    expect(changed.status).toBe(200);
    const own = GetPresetResponseSchema.parse(
      await result(await call(actor, "presetsGet", "GET")),
    ).data;
    expect(own).toMatchObject([
      { _id: id, name: "focused", config: { mode: "time", time: 60 } },
    ]);
    const other = GetPresetResponseSchema.parse(
      await result(await call(rival, "presetsGet", "GET")),
    ).data;
    expect(other).toEqual([]);
    expect(
      (await call(actor, "presetsDelete", "POST", { params: { presetId: id } }))
        .status,
    ).toBe(200);
    expect(
      GetPresetResponseSchema.parse(
        await result(await call(actor, "presetsGet", "GET")),
      ).data,
    ).toEqual([]);
  });

  it("preserves historical preference migrations without rewriting stored data", async () => {
    const actor = await account();
    const db = await mf.getD1Database("DB", "a");
    const legacy = {
      theme: "nord",
      swapEscAndTab: true,
      smoothCaret: true,
      alwaysShowCPM: true,
      fontSize: "125",
    };
    await db
      .prepare("INSERT INTO configs(uid,id,data) VALUES(?,?,?)")
      .bind(actor.uid, "legacy-config", JSON.stringify(legacy))
      .run();
    const response = await call(actor, "configsGet", "GET");
    expect(response.status, await response.clone().text()).toBe(200);
    expect(
      GetConfigResponseSchema.parse(await result(response)).data,
    ).toMatchObject({
      theme: "nord",
      quickRestart: "esc",
      smoothCaret: "medium",
      typingSpeedUnit: "cpm",
      fontSize: 1.25,
    });
    expect(
      JSON.parse(
        (await db
          .prepare("SELECT data FROM configs WHERE uid=?")
          .bind(actor.uid)
          .first<string>("data")) ?? "{}",
      ),
    ).toEqual(legacy);
  });

  it("loads saved presets containing historical settings without rewriting them", async () => {
    const actor = await account();
    const db = await mf.getD1Database("DB", "a");
    const legacy = {
      name: "historical",
      config: {
        theme: "nord",
        smoothCaret: true,
        tags: ["0123456789abcdef01234567"],
      },
    };
    await db
      .prepare("INSERT INTO presets(id,uid,timestamp,data) VALUES(?,?,0,?)")
      .bind("abcdef0123456789abcdef01", actor.uid, JSON.stringify(legacy))
      .run();
    const response = await call(actor, "presetsGet", "GET");
    expect(response.status, await response.clone().text()).toBe(200);
    expect(
      GetPresetResponseSchema.parse(await result(response)).data,
    ).toMatchObject([
      {
        name: "historical",
        config: {
          theme: "nord",
          smoothCaret: "medium",
          tags: legacy.config.tags,
        },
      },
    ]);
    expect(
      await db
        .prepare("SELECT data FROM presets WHERE uid=?")
        .bind(actor.uid)
        .first("data"),
    ).toBe(JSON.stringify(legacy));
  });

  it("keeps malformed wrapped preferences visible instead of replacing them with defaults", async () => {
    const actor = await account();
    const db = await mf.getD1Database("DB", "a");
    await db
      .prepare("INSERT INTO configs(uid,id,data) VALUES(?,?,?)")
      .bind(
        actor.uid,
        "wrapped-config",
        JSON.stringify({ config: { theme: "nord" } }),
      )
      .run();
    const response = await call(actor, "configsGet", "GET");
    expect(response.status).toBe(500);
    expect(await result(response)).toMatchObject({
      ok: false,
      message:
        "Config data is not in the correct format. Please refresh the page or contact support.",
    });
  });

  it("claims a reward once through repeated RPCs", async () => {
    const actor = await account();
    const db = await mf.getD1Database("DB", "a");
    const rewards = [{ type: "xp", item: 50 }];
    const mail = {
      id: "0123456789abcdef01234567",
      subject: "Reward",
      body: "fixture",
      timestamp: Date.now(),
      read: false,
      rewards,
    };
    await db.batch([
      db
        .prepare(
          "INSERT INTO inbox(id,uid,timestamp,read,data) VALUES(?,?,?,0,?)",
        )
        .bind(mail.id, actor.uid, mail.timestamp, JSON.stringify(mail)),
      db
        .prepare(
          "INSERT INTO reward_grants(id,uid,origin,claimed,data) VALUES(?,?,?,0,?)",
        )
        .bind(
          `${actor.uid}:${mail.id}`,
          actor.uid,
          mail.id,
          JSON.stringify({ rewards }),
        ),
    ]);
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await call(actor, "usersUpdateInbox", "POST", {
        body: { mailIdsToMarkRead: [mail.id] },
      });
      expect(response.status, await response.clone().text()).toBe(200);
    }
    expect(
      await db
        .prepare("SELECT xp FROM users WHERE uid=?")
        .bind(actor.uid)
        .first("xp"),
    ).toBe(50);
    expect(
      await db
        .prepare("SELECT claimed FROM reward_grants WHERE uid=?")
        .bind(actor.uid)
        .first("claimed"),
    ).toBe(1);
  });

  it("rechecks fresh-session and moderator permissions on actual mutation/read functions", async () => {
    const actor = await account();
    const db = await mf.getD1Database("DB", "a");
    await db
      .prepare("UPDATE auth_sessions SET created_at=? WHERE token=?")
      .bind(Date.now() - 120_000, actor.token)
      .run();
    expect(
      (
        await call(actor, "usersUpdateName", "POST", {
          body: { name: "Renamed" },
        })
      ).status,
    ).toBe(401);
    expect((await call(actor, "quotesGet", "GET")).status).toBe(403);
    await db
      .prepare("UPDATE auth_sessions SET created_at=? WHERE token=?")
      .bind(Date.now(), actor.token)
      .run();
    expect(
      (
        await call(actor, "usersUpdateName", "POST", {
          body: { name: "Renamed" },
        })
      ).status,
    ).toBe(200);
    expect(
      await db
        .prepare("SELECT name FROM users WHERE uid=?")
        .bind(actor.uid)
        .first("name"),
    ).toBe("Renamed");
  });
});
