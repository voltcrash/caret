import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createWorkerd, seedSession } from "./workerd";

describe("pilot shared services in workerd", () => {
  let mf: Awaited<ReturnType<typeof createWorkerd>>;
  beforeAll(async () => {
    mf = await createWorkerd(true);
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
});
