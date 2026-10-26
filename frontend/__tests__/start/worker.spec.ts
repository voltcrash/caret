import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { toJSONAsync } from "seroval";
import { createWorkerd, seedLeaderboard, seedSession } from "./workerd";
import { rpcPath } from "./rpc";

describe("built Start application in workerd", () => {
  let mf: Awaited<ReturnType<typeof createWorkerd>>;
  beforeAll(async () => {
    mf = await createWorkerd();
    await seedLeaderboard(mf, "a", 1);
    await seedLeaderboard(mf, "b", 2);
  });
  afterAll(async () => await mf?.dispose());

  it("executes real RPC with origin protection and stable rate limits", async () => {
    const worker = await mf.getWorker("a");
    const payload = encodeURIComponent(
      JSON.stringify(await toJSONAsync({ data: { query: { client: "web" } } })),
    );
    const url = `http://localhost:3000${rpcPath("publicGetTypingStats")}?payload=${payload}`;
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
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=60",
    );
    // The Worker stores the copy in waitUntil; it may land after the response.
    let shared = await worker.fetch(url, { headers });
    for (
      let tries = 0;
      shared.headers.get("x-caret-cache") === null;
      tries++
    ) {
      if (tries === 20) throw new Error("Public read was never cached");
      await shared.arrayBuffer();
      await new Promise((resolve) => setTimeout(resolve, 25));
      shared = await worker.fetch(url, { headers });
    }
    expect(shared.headers.get("x-request-id")).not.toBe(
      response.headers.get("x-request-id"),
    );
    expect(await shared.text()).toContain("testsCompleted");
    // publicStatsGet allows 60 per minute; no-cache reaches the limiter.
    // Headroom: the fixed one-minute window may roll over mid-loop.
    const uncached = { ...headers, "cache-control": "no-cache" };
    let limited = response;
    for (let sent = 1; limited.status === 200 && sent <= 2 * 60 + 1; sent++) {
      limited = await worker.fetch(url, { headers: uncached });
    }
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).not.toBeNull();
  });

  it("answers another build's unknown function ID with an explicit stale-client conflict", async () => {
    const worker = await mf.getWorker("a");
    const url = `http://localhost:3000/_serverFn/${"0".repeat(64)}`;
    const headers = {
      "x-tsr-serverFn": "true",
      origin: "http://localhost:3000",
      "content-type": "application/json",
      "X-Client-Version": "previous-build",
    };
    for (const method of ["GET", "POST"]) {
      const response = await worker.fetch(url, {
        method,
        headers,
        ...(method === "POST" ? { body: "{}" } : {}),
      });
      expect(response.status).toBe(409);
      expect(response.headers.get("X-Caret-Stale-Client")).toBe("1");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.text()).toBe(
        "Oxytype was updated. Refresh the page to continue.",
      );
    }
    // Same-origin protection still applies before function lookup.
    const crossSite = await worker.fetch(url, {
      method: "POST",
      body: "{}",
      headers: { ...headers, origin: "https://attacker.test" },
    });
    expect(crossSite.status).toBe(403);
    expect(crossSite.headers.has("X-Caret-Stale-Client")).toBe(false);
  });

  it("SSR reads real D1 through the function and keeps binding-specific caches isolated", async () => {
    const [a, b] = await Promise.all([mf.getWorker("a"), mf.getWorker("b")]);
    const responses = await Promise.all(
      Array.from(
        { length: 6 },
        async (_, i) =>
          await (i % 2 ? b : a).fetch("http://localhost:3000/leaderboards"),
      ),
    );
    for (const [i, response] of responses.entries()) {
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain("Leaderboards | Oxytype");
      expect(html).toContain("racer-1<");
      if (i % 2) expect(html).toContain("racer-2<");
      else expect(html).not.toContain("racer-2<");
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

  it("owns unknown-route 404s inside the application layout", async () => {
    for (const path of ["/missing", "/404.html", "/profile/a/b"]) {
      const response = await mf.dispatchFetch(`http://localhost:3000${path}`);
      expect(response.status).toBe(404);
      const html = await response.text();
      expect(html).toContain("404 | Oxytype");
      expect(html).toContain("Ooops! Looks like this page");
      expect(html).toContain('aria-label="Main navigation"');
    }
  });

  it("redirects former entry URLs to canonical routes with their query", async () => {
    for (const [path, location] of [
      ["/index.html?mode=time", "/?mode=time"],
      ["/index", "/"],
      ["/privacy-policy", "/privacy-policy.html"],
      ["/oauth-callback?requestId=a", "/oauth-callback.html?requestId=a"],
      ["/404", "/404.html"],
    ] as const) {
      const response = await mf.dispatchFetch(`http://localhost:3000${path}`, {
        redirect: "manual",
      });
      expect(response.status).toBe(301);
      expect(
        new URL(response.headers.get("location") ?? "", "http://x").href,
      ).toBe(new URL(location, "http://x").href);
    }
  });

  it("server-renders the privacy policy at its published URL", async () => {
    const response = await mf.dispatchFetch(
      "http://localhost:3000/privacy-policy.html",
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("Privacy Policy | Oxytype");
    expect(html).toContain('content="noindex"');
    expect(html).toContain("Visit project discussions");
  });

  it("serves retained HTTP contracts in-process with their legacy policies", async () => {
    const worker = await mf.getWorker("b");
    const health = await worker.fetch("http://localhost:3000/api");
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ message: "ok" });
    const stats = await worker.fetch(
      "http://localhost:3000/api/public/typingStats",
      { headers: { "cf-connecting-ip": "192.0.2.9" } },
    );
    expect(stats.status).toBe(200);
    expect(stats.headers.get("x-compatibility-check")).not.toBeNull();
    expect(await stats.json()).toMatchObject({
      data: { testsCompleted: 22 },
    });
    const missing = await worker.fetch("http://localhost:3000/api/missing");
    expect(missing.status).toBe(404);
    expect(await missing.text()).not.toContain("Ooops!");
    const privateRead = await worker.fetch("http://localhost:3000/api/users");
    expect(privateRead.status).toBe(401);
    const session = await seedSession(mf, "b");
    const crossSite = await worker.fetch(
      "http://localhost:3000/api/users/tags",
      {
        method: "POST",
        headers: {
          cookie: session.cookie,
          origin: "https://attacker.test",
          "content-type": "application/json",
        },
        body: JSON.stringify({ tagName: "x" }),
      },
    );
    expect(crossSite.status).toBe(403);
  });

  it("exports a working scheduled handler with D1", async () => {
    const worker = await mf.getWorker("a");
    const db = await mf.getD1Database("DB", "a");
    await db
      .prepare("INSERT INTO write_receipts(id,created_at) VALUES('expired',0)")
      .run();
    const scheduled = await worker.scheduled({
      scheduledTime: new Date(0),
      cron: "0 * * * *",
    });
    expect(scheduled.outcome).toBe("ok");
    expect(
      await db
        .prepare("SELECT id FROM write_receipts WHERE id='expired'")
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
