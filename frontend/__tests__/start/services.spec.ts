import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { toJSONAsync } from "seroval";
import { createWorkerd, relaxRateLimits, seedSession } from "./workerd";

describe("pilot shared services in workerd", () => {
  let mf: Awaited<ReturnType<typeof createWorkerd>>;
  beforeAll(async () => {
    // Admin probes (adminLimit) and fresh-session probes (userRevokeAllTokens) repeat.
    mf = await createWorkerd(
      true,
      undefined,
      false,
      {},
      {
        onOptions: relaxRateLimits("RATE_LIMIT_10S_2", "RATE_LIMIT_60S_1"),
      },
    );
  });
  afterAll(async () => await mf?.dispose());
  it("requires a server-verified actor on a direct private RPC", async () => {
    const worker = await mf.getWorker("a");
    const url = "http://localhost:3000/__test/account";
    const headers = {
      origin: "http://localhost:3000",
      "x-tsr-serverFn": "true",
    };
    expect((await worker.fetch(url, { headers })).status).toBe(401);
    const session = await seedSession(mf, "a");
    const db = await mf.getD1Database("DB", "a");
    await db
      .prepare(
        "INSERT INTO users(uid,id,name,name_key,email,added_at,data) VALUES(?,?,?,?,?,0,?)",
      )
      .bind(
        session.uid,
        session.uid,
        "fixture",
        "fixture",
        "a@example.test",
        JSON.stringify({
          uid: session.uid,
          startedTests: 3,
          completedTests: 2,
          timeTyping: 12,
        }),
      )
      .run();
    const response = await worker.fetch(url, {
      headers: { ...headers, authorization: `Bearer ${session.token}` },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain(session.token);
    await db
      .prepare("DELETE FROM auth_sessions WHERE token=?")
      .bind(session.token)
      .run();
    expect(
      (
        await worker.fetch(url, {
          headers: { ...headers, authorization: `Bearer ${session.token}` },
        })
      ).status,
    ).toBe(401);
  });
  it("enforces fresh sessions and admin/config gates without a layout visit", async () => {
    const worker = await mf.getWorker("b");
    const db = await mf.getD1Database("DB", "b");
    const session = await seedSession(mf, "b");
    const headers = {
      origin: "http://localhost:3000",
      "x-tsr-serverFn": "true",
      authorization: `Bearer ${session.token}`,
      "content-type": "application/json",
    };
    const call = async (
      kind: string,
    ): Promise<Awaited<ReturnType<typeof worker.fetch>>> => {
      return await worker.fetch(`http://localhost:3000/__test/${kind}`, {
        method: "POST",
        headers,
        body: JSON.stringify(await toJSONAsync({})),
      });
    };
    await db
      .prepare(
        "UPDATE configuration SET data=json_set(data,'$.admin.endpointsEnabled',json('true')) WHERE id='main'",
      )
      .run();
    // Ensure a configuration row exists before mutating it.
    await worker.fetch("http://localhost:3000/leaderboards");
    await db
      .prepare(
        "UPDATE configuration SET data=json_set(data,'$.admin.endpointsEnabled',json('true')) WHERE id='main'",
      )
      .run();
    expect((await call("admin")).status).toBe(403);
    await db
      .prepare("INSERT INTO admin_uids(uid) VALUES(?)")
      .bind(session.uid)
      .run();
    expect((await call("admin")).status).toBe(200);
    await db
      .prepare(
        "UPDATE configuration SET data=json_set(data,'$.admin.endpointsEnabled',json('false')) WHERE id='main'",
      )
      .run();
    expect((await call("admin")).status).toBe(503);
    await db
      .prepare("UPDATE auth_sessions SET created_at=? WHERE token=?")
      .bind(Date.now() - 120_000, session.token)
      .run();
    expect((await call("fresh")).status).toBe(401);
    await db
      .prepare("UPDATE auth_sessions SET created_at=? WHERE token=?")
      .bind(Date.now(), session.token)
      .run();
    expect((await call("fresh")).status).toBe(200);
    expect((await call("fresh")).status).toBe(401);
  });
  it("bounds compressed payloads and rejects unsupported encodings", async () => {
    const worker = await mf.getWorker("a");
    const { gzipSync } = await import("node:zlib");
    const headers = {
      origin: "http://localhost:3000",
      "x-tsr-serverFn": "true",
      "content-type": "application/json",
      "content-encoding": "gzip",
    };
    expect(
      (
        await worker.fetch("http://localhost:3000/__test/admin", {
          method: "POST",
          headers,
          body: gzipSync("x".repeat(102_401)),
        })
      ).status,
    ).toBe(413);
    expect(
      (
        await worker.fetch("http://localhost:3000/__test/admin", {
          method: "POST",
          headers: { ...headers, "content-encoding": "unknown" },
          body: JSON.stringify(await toJSONAsync({})),
        })
      ).status,
    ).toBe(415);
  });

  it("maps malformed direct function input to 422", async () => {
    const worker = await mf.getWorker("a");
    const response = await worker.fetch(
      `http://localhost:3000/__test/account?payload=${encodeURIComponent(
        JSON.stringify(await toJSONAsync({ data: 42 })),
      )}`,
      {
        headers: { origin: "http://localhost:3000", "x-tsr-serverFn": "true" },
      },
    );
    expect(response.status).toBe(422);
  });
  it("uses trusted IP, rejects expired sessions and applies bad-auth/root/maintenance gates", async () => {
    const worker = await mf.getWorker("a");
    const db = await mf.getD1Database("DB", "a");
    const session = await seedSession(mf, "a");
    const url = "http://localhost:3000/__test/account";
    const headers = {
      origin: "http://localhost:3000",
      "x-tsr-serverFn": "true",
      authorization: `Bearer ${session.token}`,
      "cf-connecting-ip": "192.0.2.83",
      "x-forwarded-for": "1.2.3.4",
    };
    await db
      .prepare("UPDATE auth_sessions SET expires_at=0 WHERE token=?")
      .bind(session.token)
      .run();
    expect((await worker.fetch(url, { headers })).status).toBe(401);
    // Root allows 67 per minute per trusted IP; the spoofed hop has no budget of its own.
    let limited = await worker.fetch(url, { headers });
    // Headroom: the fixed one-minute window may roll over mid-loop.
    for (let sent = 2; limited.status !== 429 && sent <= 2 * 67 + 1; sent++) {
      limited = await worker.fetch(url, {
        headers: { ...headers, "x-forwarded-for": `1.2.3.${sent}` },
      });
    }
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("60");
    const fresh = { ...headers, "cf-connecting-ip": "192.0.2.84" };
    await db
      .prepare(
        "UPDATE configuration SET data=json_set(data,'$.rateLimiting.badAuthentication.enabled',json('true'),'$.rateLimiting.badAuthentication.penalty',30,'$.rateLimiting.badAuthentication.flaggedStatusCodes',json('[401]')) WHERE id='main'",
      )
      .run();
    expect((await worker.fetch(url, { headers: fresh })).status).toBe(401);
    expect((await worker.fetch(url, { headers: fresh })).status).toBe(429);
    await db
      .prepare(
        "UPDATE configuration SET data=json_set(data,'$.rateLimiting.badAuthentication.enabled',json('false')) WHERE id='main'",
      )
      .run();
    await db
      .prepare(
        "UPDATE configuration SET data=json_set(data,'$.maintenance',json('true')) WHERE id='main'",
      )
      .run();
    expect(
      (
        await worker.fetch(url, {
          headers: { ...headers, "cf-connecting-ip": "192.0.2.85" },
        })
      ).status,
    ).toBe(503);
    await db
      .prepare(
        "UPDATE configuration SET data=json_set(data,'$.maintenance',json('false')) WHERE id='main'",
      )
      .run();
  });
});
