import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import { createWorkerd, seedSession } from "./workerd";
import { rpcPath } from "./rpc";
import { z } from "zod";
import { fromCrossJSON, toJSONAsync } from "seroval";
import { SessionStateSchema } from "@caret/schemas/auth-session";
let mf: Awaited<ReturnType<typeof createWorkerd>>;
beforeAll(async () => {
  mf = await createWorkerd(false, undefined, true);
});
afterAll(async () => await mf?.dispose());
it("preserves existing cookie identity and sends only safe session UI data", async () => {
  const session = await seedSession(mf, "a");
  const worker = await mf.getWorker("a");
  const headers = {
    cookie: session.cookie,
    origin: "http://localhost:3000",
    "x-tsr-serverFn": "true",
  };
  const response = await worker.fetch(
    `http://localhost:3000${rpcPath("getSessionState")}`,
    { headers },
  );
  expect(response.status).toBe(200);
  const text = await response.text();
  for (const secret of [
    session.token,
    "accessToken",
    "auth_sessions",
    "BETTER_AUTH_SECRET",
  ]) {
    expect(text).not.toContain(secret);
  }
  const result = fromCrossJSON(JSON.parse(text), { refs: new Map() });
  const state = z.object({ result: SessionStateSchema }).parse(result).result;
  expect(state.user).toMatchObject({ uid: session.uid, registered: false });
  const signout = await worker.fetch(
    "http://localhost:3000/api/auth/sign-out",
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: "{}",
    },
  );
  expect(signout.status).toBe(200);
  expect(
    signout.headers
      .getSetCookie()
      .some(
        (cookie) =>
          cookie.includes("oxytype.session_token=") &&
          cookie.includes("Max-Age=0"),
      ),
  ).toBe(true);
  const expired = await worker.fetch(
    `http://localhost:3000${rpcPath("getSessionState")}`,
    { headers },
  );
  expect(await expired.text()).not.toContain(session.uid);
});
it("cancels only unfinished signup and maps expired cancellation to 401", async () => {
  const session = await seedSession(mf, "b");
  const worker = await mf.getWorker("b");
  const headers = {
    authorization: `Bearer ${session.token}`,
    origin: "http://localhost:3000",
    "content-type": "application/json",
  };
  const cancel = async (): Promise<Awaited<ReturnType<typeof worker.fetch>>> =>
    await worker.fetch("http://localhost:3000/api/auth/cancel-sign-up", {
      method: "POST",
      headers,
      body: "{}",
    });
  expect((await cancel()).status).toBe(200);
  expect((await cancel()).status).toBe(401);
  const db = await mf.getD1Database("DB", "b");
  expect(
    await db
      .prepare("SELECT id FROM auth_users WHERE id=?")
      .bind(session.uid)
      .first(),
  ).toBeNull();
});
it("renders the native auth shell without private credential serialization", async () => {
  const worker = await mf.getWorker("a");
  for (const path of ["/login"]) {
    const response = await worker.fetch(`http://localhost:3000${path}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const html = await response.text();
    expect(html).toContain("Sign in");
    expect(html).not.toContain("auth_sessions");
    expect(response.headers.get("Content-Security-Policy")).toContain(
      "https://challenges.cloudflare.com",
    );
  }
});

it("completes signup through real RPC/D1 and protects completed registration from cancellation", async () => {
  const session = await seedSession(mf, "b");
  const worker = await mf.getWorker("b");
  const headers = {
    cookie: session.cookie,
    origin: "http://localhost:3000",
    "x-tsr-serverFn": "true",
    "content-type": "application/json",
  };
  const response = await worker.fetch(
    `http://localhost:3000${rpcPath("completeSignUp")}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(
        await toJSONAsync({
          data: { name: "StartSignup", captcha: "local-test-token" },
        }),
      ),
    },
  );
  expect(response.status).toBe(200);
  const db = await mf.getD1Database("DB", "b");
  expect(
    await db
      .prepare("SELECT name FROM users WHERE uid=?")
      .bind(session.uid)
      .first<string>("name"),
  ).toBe("StartSignup");
  const cancel = await worker.fetch(
    "http://localhost:3000/api/auth/cancel-sign-up",
    { method: "POST", headers, body: "{}" },
  );
  expect(cancel.status).toBe(409);
  expect(
    await db
      .prepare("SELECT id FROM auth_users WHERE id=?")
      .bind(session.uid)
      .first(),
  ).not.toBeNull();
});

it.each(["cookie", "bearer"] as const)(
  "blocks disabled %s sessions in the built auth Worker",
  async (credential) => {
    const identity = await seedSession(mf, "a");
    const worker = await mf.getWorker("a");
    const db = await mf.getD1Database("DB", "a");
    await db
      .prepare("UPDATE auth_users SET disabled=1 WHERE id=?")
      .bind(identity.uid)
      .run();
    const headers =
      credential === "cookie"
        ? { cookie: identity.cookie, origin: "http://localhost:3000" }
        : { authorization: `Bearer ${identity.token}` };
    const response = await worker.fetch(
      "http://localhost:3000/api/auth/update-user",
      {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ name: "Forbidden mutation", disabled: false }),
      },
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      message: "Account disabled",
    });
    expect(
      await db
        .prepare("SELECT name,disabled FROM auth_users WHERE id=?")
        .bind(identity.uid)
        .first(),
    ).toMatchObject({ name: "a", disabled: 1 });
    expect(
      await db
        .prepare("SELECT id FROM auth_sessions WHERE user_id=?")
        .bind(identity.uid)
        .first(),
    ).toBeNull();
    expect(
      (await worker.fetch("http://localhost:3000/api/users/stats", { headers }))
        .status,
    ).toBe(401);
    const state = await worker.fetch(
      `http://localhost:3000${rpcPath("getSessionState")}`,
      {
        headers: {
          ...headers,
          origin: "http://localhost:3000",
          "x-tsr-serverFn": "true",
        },
      },
    );
    expect(state.status).toBe(200);
    const text = await state.text();
    expect(text).not.toContain(identity.uid);
    expect(text).not.toContain(identity.token);
  },
);

it("redacts configuration failures on direct session and operation RPCs", async () => {
  const worker = await mf.getWorker("b");
  const db = await mf.getD1Database("DB", "b");
  await db.prepare("DROP TABLE configuration").run();
  const payload = encodeURIComponent(
    JSON.stringify(await toJSONAsync({ data: { query: { client: "web" } } })),
  );
  for (const path of [
    rpcPath("getSessionState"),
    `${rpcPath("publicGetTypingStats")}?payload=${payload}`,
  ]) {
    const response = await worker.fetch(`http://localhost:3000${path}`, {
      headers: { origin: "http://localhost:3000", "x-tsr-serverFn": "true" },
    });
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain("no such table");
    expect(text).not.toContain("select ");
  }
});
