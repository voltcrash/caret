import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { fromCrossJSON, toJSONAsync, type SerovalNode } from "seroval";
import { z } from "zod";
import {
  AddPresetResponseSchemna,
  GetPresetResponseSchema,
} from "@caret/contracts/presets";
import { GetConfigResponseSchema } from "@caret/contracts/configs";
import { createWorkerd, seedSession } from "./workerd";
import { rpcPath } from "./rpc";

describe("ordinary server-function mutations with real PostgreSQL", () => {
  let mf: Awaited<ReturnType<typeof createWorkerd>>;
  type Session = Awaited<ReturnType<typeof seedSession>>;
  type Reply = Awaited<
    ReturnType<Awaited<ReturnType<typeof mf.getWorker>>["fetch"]>
  >;
  let index = 0;
  beforeAll(async () => {
    mf = await createWorkerd();
  });
  afterAll(async () => await mf?.dispose());

  async function account(): Promise<Session> {
    const session = await seedSession(mf, "a");
    const db = await mf.getDatabase("a");
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
    const db = await mf.getDatabase("a");
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
    const db = await mf.getDatabase("a");
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
      JSON.parse((await db
        .prepare("SELECT data FROM presets WHERE uid=?")
        .bind(actor.uid)
        .first<string>("data")) ?? "{}"),
    ).toEqual(legacy);
  });

  it("keeps malformed wrapped preferences visible instead of replacing them with defaults", async () => {
    const actor = await account();
    const db = await mf.getDatabase("a");
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

  it("rechecks fresh-session and moderator permissions on actual mutation/read functions", async () => {
    const actor = await account();
    const db = await mf.getDatabase("a");
    await db
      .prepare("UPDATE auth_sessions SET created_at=? WHERE token=?")
      .bind(new Date(Date.now() - 120_000), actor.token)
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
      .bind(new Date(), actor.token)
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
