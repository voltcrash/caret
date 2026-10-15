import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createWorkerd, seedSession } from "./workerd";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function functionPath(): string {
  const dir = resolve(import.meta.dirname, "../../dist/start/server/assets");
  const file = readdirSync(dir).find((file) =>
    file.includes("server-fn-resolver"),
  );
  if (file === undefined) throw new Error("Missing function manifest");
  const id = /"([a-f0-9]{64})"/.exec(
    readFileSync(resolve(dir, file), "utf8"),
  )?.[1];
  if (id === undefined) throw new Error("Missing function ID");
  return `/_serverFn/${id}`;
}

describe("built Start application in workerd", () => {
  let mf: Awaited<ReturnType<typeof createWorkerd>>;
  beforeAll(async () => {
    mf = await createWorkerd();
  });
  afterAll(async () => await mf?.dispose());

  it("executes real RPC with origin protection and stable rate limits", async () => {
    const worker = await mf.getWorker("a");
    const url = `http://localhost:3000${functionPath()}`;
    const headers = {
      "x-tsr-serverFn": "true",
      origin: "http://localhost:3000",
      "cf-connecting-ip": "192.0.2.1",
    };
    const response = await worker.fetch(url, { headers });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("testsCompleted");
    expect(
      (
        await worker.fetch(url, {
          headers: {
            ...headers,
            origin: "https://attacker.test",
            "sec-fetch-site": "cross-site",
          },
        })
      ).status,
    ).toBe(403);
    expect(
      (await worker.fetch(url, { headers: { "x-tsr-serverFn": "true" } }))
        .status,
    ).toBe(403);
    const db = await mf.getD1Database("DB", "a");
    await db
      .prepare(
        "UPDATE rate_counters SET points=60 WHERE key='start:publicStatsGet:192.0.2.1'",
      )
      .run();
    const limited = await worker.fetch(url, { headers });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).not.toBeNull();
  });

  it("SSR reads real D1 through the function and keeps binding-specific caches isolated", async () => {
    const [a, b] = await Promise.all([mf.getWorker("a"), mf.getWorker("b")]);
    const responses = await Promise.all(
      Array.from(
        { length: 6 },
        async (_, i) =>
          await (i % 2 ? b : a).fetch("http://localhost:3000/about"),
      ),
    );
    for (const [i, response] of responses.entries()) {
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("About | Oxytype");
      expect(html).toContain(
        `data-testid="tests-completed">${i % 2 ? 22 : 11}`,
      );
      expect(html).not.toContain("stage-one-local-only-secret");
      expect(html).not.toContain("auth_sessions");
    }
  });

  it("serves same-origin auth with distinct real sessions and rejects cross-origin writes", async () => {
    const [a, b] = await Promise.all([
      seedSession(mf, "a"),
      seedSession(mf, "b"),
    ]);
    const worker = await mf.getWorker("a");
    const response = await worker.fetch(
      "http://localhost:3000/api/auth/get-session",
      { headers: { authorization: `Bearer ${a.token}` } },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user: { id: a.uid } });
    const foreign = await worker.fetch(
      "http://localhost:3000/api/auth/get-session",
      { headers: { authorization: `Bearer ${b.token}` } },
    );
    expect(await foreign.json()).toBeNull();
    expect(
      (
        await worker.fetch("http://localhost:3000/api/auth/sign-out", {
          method: "POST",
          headers: {
            origin: "https://attacker.test",
            "content-type": "application/json",
          },
          body: "{}",
        })
      ).status,
    ).toBe(403);
  });

  it("owns unknown-route 404s and leaves legacy HTTP unmounted", async () => {
    for (const path of ["/missing", "/api/public/typingStats"]) {
      const response = await mf.dispatchFetch(`http://localhost:3000${path}`);
      expect(response.status).toBe(404);
      expect(await response.text()).toContain("Page not found");
    }
  });

  it("exports working queue and scheduled handlers with D1", async () => {
    const worker = await mf.getWorker("a");
    const db = await mf.getD1Database("DB", "a");
    await db
      .prepare(
        "INSERT INTO outbox(id,type,data,created_at) VALUES('done','reward',?,0)",
      )
      .bind(JSON.stringify({ uid: "missing-user", mail: [], inboxConfig: {} }))
      .run();
    const delivered = await worker.queue("oxytype-start-migration-tasks", [
      {
        id: "delivery",
        body: { id: "done", kind: "outbox" },
        timestamp: new Date(),
        attempts: 1,
      },
    ]);
    expect(delivered.outcome).toBe("ok");
    expect(delivered.explicitAcks).toContain("delivery");
    expect(
      await db
        .prepare("SELECT completed_at FROM outbox WHERE id='done'")
        .first<number>("completed_at"),
    ).toBeGreaterThan(0);
    await db
      .prepare(
        "INSERT INTO rate_counters(key,points,expires_at) VALUES('expired',1,0)",
      )
      .run();
    const scheduled = await worker.scheduled({
      scheduledTime: new Date(0),
      cron: "* * * * *",
    });
    expect(scheduled.outcome).toBe("ok");
    expect(
      await db
        .prepare("SELECT key FROM rate_counters WHERE key='expired'")
        .first(),
    ).toBeNull();
  });
});

describe("invocation lifetime under streamed callbacks", () => {
  let mf: Awaited<ReturnType<typeof createWorkerd>>;
  beforeAll(async () => {
    mf = await createWorkerd(true);
  });
  afterAll(async () => await mf?.dispose());
  it("preserves actors, bindings and waitUntil after the fetch response returns", async () => {
    const accounts = await Promise.all([
      seedSession(mf, "a"),
      seedSession(mf, "b"),
    ]);
    const results = await Promise.all(
      ["a", "b"].map(async (name, i) => {
        const worker = await mf.getWorker(name);
        const response = await worker.fetch(
          `http://localhost:3000/__test/stream?delay=${i ? 5 : 20}`,
          { headers: { authorization: `Bearer ${accounts[i]?.token}` } },
        );
        return await response.text();
      }),
    );
    for (const [i, name] of ["a", "b"].entries()) {
      expect(results[i]).toBe(
        `${accounts[i]?.uid}:${name}:start\n${accounts[i]?.uid}:${name}:true:end\n`,
      );
      const db = await mf.getD1Database("DB", name);
      await expect
        .poll(async () => await db.prepare("SELECT * FROM probe").all())
        .toMatchObject({
          results: [{ actor: accounts[i]?.uid, version: name, isolated: 1 }],
        });
    }
  });
});
