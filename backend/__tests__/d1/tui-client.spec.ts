import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  CompletedEventSchema,
  type CompletedEvent,
} from "@oxytype/schemas/results";

import { openAccount, type Account } from "../../../tui/src/account";
import { networkSettingsSchema } from "../../../tui/src/api/settings";
import { pollDeviceToken } from "../../../tui/src/auth/device";
import { openConfigStore } from "../../../tui/src/config/store";
import type { FinishedTest } from "../../../tui/src/test/typing-test";
import { createTestRuntime } from "./helpers";
import { withRuntime } from "../../src/runtime/env";
import { getAuth } from "../../src/init/auth";
import { patchConfiguration } from "../../src/init/configuration";
import * as Users from "../../src/dal/user";
import * as Results from "../../src/dal/result";
import * as Configs from "../../src/dal/config";
import { consistency } from "../../src/anticheat/result";
import Worker from "../../src/worker";

describe("actual terminal client against D1", () => {
  let runtime: Awaited<ReturnType<typeof createTestRuntime>>;
  let directory: string;
  let account: Account | undefined;
  let uid: string;
  let browserToken: string;
  let online = true;
  const paths = (): { config: string; data: string; cache: string } => ({
    config: join(directory, "config"),
    data: join(directory, "data"),
    cache: join(directory, "cache"),
  });

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "oxytype-tui-d1-"));
    runtime = await createTestRuntime();
    runtime.env.MODE = "production";
    runtime.env.BETTER_AUTH_URL = "http://localhost:5005/api/auth";
    runtime.env.BETTER_AUTH_SECRET =
      "tui-client-integration-secret-at-least-thirty-two-characters";
    await withRuntime(runtime.env, async () => {
      await patchConfiguration({
        results: { savingEnabled: true, objectHashCheckEnabled: true },
        users: { xp: { enabled: true } },
      });
      const context = await getAuth().$context;
      const user = await context.internalAdapter.createUser(
        {
          name: "Terminal",
          email: "terminal@example.test",
          emailVerified: true,
        },
        { method: "oauth", oauth: { providerId: "github" } },
      );
      uid = user.id;
      await Users.addUser(user.name, user.email, uid);
      await runtime.env.DB.prepare(
        "UPDATE users SET added_at=0,data=json_set(data,'$.addedAt',0) WHERE uid=?",
      )
        .bind(uid)
        .run();
      await Users.updateTypingStats(uid, 0, 31, "tui");
      const session = await context.internalAdapter.createSession(uid, false);
      if (session === null) throw new Error("Missing browser session");
      browserToken = session.token;
    });
  });
  afterAll(async () => {
    await account?.flush();
    account?.stop();
    await runtime?.dispose();
    if (directory !== undefined) {
      await rm(directory, { recursive: true, force: true });
    }
  });
  async function request(path: string, body?: object): Promise<Response> {
    return await Worker.fetch(
      new Request(`http://localhost:5005/api${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          authorization: `Bearer ${browserToken}`,
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      runtime.env,
      { waitUntil: () => undefined } as unknown as ExecutionContext,
    );
  }
  async function finished(
    owner: NonNullable<ReturnType<Account["identity"]>>,
    offline = false,
  ): Promise<FinishedTest> {
    const fixture = JSON.parse(
      await readFile(
        resolve(__dirname, "../__testData__/terminal-words-10.json"),
        "utf8",
      ),
    ) as { result: CompletedEvent; eventLog: FinishedTest["eventLog"] };
    const {
      uid: _uid,
      hash: _hash,
      ...result
    } = CompletedEventSchema.parse(fixture.result);
    result.timestamp = Date.now() - (offline ? 86400_000 : 0);
    if (offline && result.keySpacing !== "toolong") {
      result.keySpacing = result.keySpacing.map((gap) => gap * 0.98);
      result.keyConsistency = consistency(result.keySpacing.slice(0, -1));
      result.lastKeyToEnd =
        result.testDuration * 1000 -
        result.keySpacing.reduce((sum, gap) => sum + gap, 0);
    }
    return { result, eventLog: fixture.eventLog, rawHistory: [], owner };
  }

  it("completes consent, syncs, uploads real terminal telemetry, recovers offline and revokes", async () => {
    const config = await openConfigStore(join(paths().config, "config.json"));
    config.set("theme", "serika");
    await withRuntime(
      runtime.env,
      async () =>
        await Configs.saveConfig(uid, {
          theme: "nord",
          mode: "words",
          words: 10,
        }),
    );
    let approval = Promise.resolve();
    let loseResultResponse = false;
    const options: Parameters<typeof openAccount>[0] = {
      paths: paths(),
      config,
      settings: networkSettingsSchema.parse({
        apiUrl: "http://localhost:5005/api",
      }),
      fetch: async (input, init) => {
        if (!online) throw new Error("offline");
        const native = new Request(input, init);
        expect(native.headers.has("origin")).toBe(false);
        expect(native.headers.has("cookie")).toBe(false);
        const response = await Worker.fetch(native, runtime.env, {
          waitUntil: () => undefined,
        } as unknown as ExecutionContext);
        if (
          loseResultResponse &&
          native.method === "POST" &&
          new URL(native.url).pathname === "/api/results" &&
          response.status === 200
        ) {
          loseResultResponse = false;
          throw new Error("Connection lost after result committed");
        }
        return response;
      },
      browser: async (url) => {
        approval = (async () => {
          const code = new URL(url).searchParams.get("user_code");
          expect(code).not.toBeNull();
          expect(
            (
              await request(
                `/auth/device?user_code=${encodeURIComponent(code ?? "")}`,
              )
            ).status,
          ).toBe(200);
          expect(
            (await request("/auth/device/approve", { userCode: code })).status,
          ).toBe(200);
        })();
        await approval;
      },
      poll: async (api, code, signal) => {
        await approval;
        return await pollDeviceToken(api, code, signal, {
          wait: async () => undefined,
        });
      },
    };
    account = await openAccount(options);
    await account.auth.login();
    expect(account.auth.notice()).toBeUndefined();
    expect(account.auth.state()).toBe("authenticated");
    expect(config.config.theme).toBe("nord");
    expect(
      (await stat(join(paths().data, "credentials.json"))).mode & 0o777,
    ).toBe(0o600);
    const credential = JSON.parse(
      await readFile(join(paths().data, "credentials.json"), "utf8"),
    ) as { accessToken: string };
    expect(
      (
        await account.api.client.public.getTypingStats({
          query: { client: "tui" },
        })
      ).status,
    ).toBe(200);
    config.set("theme", "serika");
    await account.sync.flush();
    expect(
      await withRuntime(
        runtime.env,
        async () =>
          await runtime.env.DB.prepare("SELECT data FROM configs WHERE uid=?")
            .bind(uid)
            .first<{ data: string }>(),
      ),
    ).toMatchObject({ data: expect.stringContaining('"serika"') });

    const owner = account.identity();
    if (owner === undefined) throw new Error("Missing terminal identity");
    await account.uploads.accept(await finished(owner));
    expect(account.uploads.last()?.message).toBe("uploaded");
    expect(account.uploads.last()?.isPb).toBe(true);
    const history = await account.api.client.results.get({
      query: { client: "tui" },
    });
    expect(history.status).toBe(200);
    if (history.status !== 200) throw new Error("Missing result history");
    expect(history.body.data).toHaveLength(1);
    expect(history.body.data[0]?.client).toBe("tui");

    const beforeOffline = await withRuntime(
      runtime.env,
      async () => await Users.getUser(uid, "before offline", "tui"),
    );
    online = false;
    await account.uploads.accept(await finished(owner, true));
    expect(account.uploads.last()?.state).toBe("queued");
    await account.flush();
    account.stop();
    account = await openAccount(options);
    expect(await account.auth.check()).toBe(false);
    expect(account.auth.state()).toBe("offline");
    online = true;
    expect(await account.auth.check()).toBe(true);
    expect(account.queue.entries()).toHaveLength(0);
    const saved = await withRuntime(
      runtime.env,
      async () => await Results.getResults(uid, { client: "tui" }),
    );
    expect(saved).toHaveLength(2);
    expect(saved.filter((row) => row.offline === true)).toHaveLength(1);
    const offlineRow = saved.find((row) => row.offline === true);
    expect(offlineRow?.isPb).not.toBe(true);
    const afterOffline = await withRuntime(
      runtime.env,
      async () => await Users.getUser(uid, "after offline", "tui"),
    );
    expect(afterOffline.completedTests).toBe(
      (beforeOffline.completedTests ?? 0) + 1,
    );
    expect(afterOffline.xp).toBe(beforeOffline.xp);
    expect(afterOffline.personalBests).toEqual(beforeOffline.personalBests);

    await runtime.env.DB.prepare(
      "UPDATE results SET timestamp=timestamp-120000 WHERE uid=?",
    )
      .bind(uid)
      .run();
    loseResultResponse = true;
    await account.uploads.accept(await finished(owner));
    expect(account.uploads.last()?.state).toBe("queued");
    expect(account.queue.entries()).toHaveLength(1);
    const committed = await withRuntime(
      runtime.env,
      async () => await Users.getUser(uid, "lost response", "tui"),
    );
    const committedResults = await withRuntime(
      runtime.env,
      async () => await Results.getResults(uid, { client: "tui" }),
    );
    expect(committedResults).toHaveLength(3);
    await account.flush();
    account.stop();
    online = false;
    account = await openAccount(options);
    expect(account.queue.entries()).toHaveLength(1);
    online = true;
    expect(await account.auth.check()).toBe(true);
    expect(account.queue.entries()).toHaveLength(0);
    expect(
      await withRuntime(
        runtime.env,
        async () => await Results.getResults(uid, { client: "tui" }),
      ),
    ).toHaveLength(3);
    const retried = await withRuntime(
      runtime.env,
      async () => await Users.getUser(uid, "retried response", "tui"),
    );
    for (const field of [
      "completedTests",
      "startedTests",
      "timeTyping",
      "xp",
      "personalBests",
    ] as const) {
      expect(retried[field]).toEqual(committed[field]);
    }
    await account.auth.logout();
    expect(account.auth.state()).toBe("guest");
    expect(
      (
        await Worker.fetch(
          new Request("http://localhost:5005/api/results?client=tui", {
            headers: { authorization: `Bearer ${credential.accessToken}` },
          }),
          runtime.env,
          { waitUntil: () => undefined } as unknown as ExecutionContext,
        )
      ).status,
    ).toBe(401);
    expect(
      (await account.api.client.results.get({ query: { client: "tui" } }))
        .status,
    ).toBe(401);
    await config.flush();
  });
});
