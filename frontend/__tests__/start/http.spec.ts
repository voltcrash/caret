import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { allOperations } from "@oxytype/backend/policies/operations";
import {
  COMPATIBILITY_CHECK,
  COMPATIBILITY_CHECK_HEADER,
} from "@oxytype/contracts";
import { AddApeKeyResponseSchema } from "@oxytype/contracts/ape-keys";
import { createWorkerd, enableConfiguration, seedSession } from "./workerd";

describe("declared Start HTTP protocols without Hono", () => {
  let mf: Awaited<ReturnType<typeof createWorkerd>>;
  beforeAll(async () => {
    mf = await createWorkerd();
  });
  afterAll(async () => await mf?.dispose());

  it("retains the development editor and configured docs prefix without publishing private assets", async () => {
    const dev = await createWorkerd(false, undefined, false, {
      MODE: "dev",
      API_PATH_OVERRIDE: "v1",
    });
    try {
      const worker = await dev.getWorker("a");
      const editor = await worker.fetch("http://localhost:3000/api/configure");
      expect(editor.status).toBe(200);
      expect(await editor.text()).toContain('<base href="/api/configure/">');
      const script = await worker.fetch(
        "http://localhost:3000/api/configure/script.js",
      );
      expect(script.status).toBe(200);
      expect(await script.text()).toContain(
        'fetch("/api/configuration/schema")',
      );
      expect(
        (await worker.fetch("http://localhost:3000/api/docs")).status,
      ).toBe(404);
      expect(
        (await worker.fetch("http://localhost:3000/api/V1/DOCS/PUBLIC")).status,
      ).toBe(200);
      expect(
        (await worker.fetch("http://localhost:3000/api/v1/docs/internal.json"))
          .status,
      ).toBe(200);
      expect(
        (await worker.fetch("http://localhost:3000/api/configuration")).status,
      ).toBe(200);
      expect(
        (await worker.fetch("http://localhost:3000/api/v1/configuration"))
          .status,
      ).toBe(404);
    } finally {
      await dev.dispose();
    }
  });

  it("dispatches every ledger operation to a JSON service/policy response", async () => {
    const worker = await mf.getWorker("a");
    let index = 1;
    for (const { id, route } of allOperations()) {
      const path = route.path.replace(/:\w+/g, "fixture");
      const response = await worker.fetch(`http://localhost:3000/api${path}`, {
        method: route.method,
        headers: {
          "cf-connecting-ip": `192.0.2.${index++}`,
          "content-type": "application/json",
        },
        ...(route.method === "GET" ? {} : { body: "{}" }),
      });
      expect(response.headers.get("content-type"), id).toContain(
        "application/json",
      );
      expect(response.headers.get(COMPATIBILITY_CHECK_HEADER), id).toBe(
        String(COMPATIBILITY_CHECK),
      );
      expect(
        response.status,
        `${id}: ${await response.clone().text()}`,
      ).not.toBe(500);
      expect(response.status, id).not.toBe(405);
      const body: unknown = await response.json();
      expect(body, id).toHaveProperty("message");
      if (response.status === 404) {
        expect(body, id).not.toHaveProperty(
          "message",
          expect.stringContaining("Unknown request URL"),
        );
      }
    }
  });

  it("preserves health, case/trailing slashes, conditional GET/HEAD, CORS and unknown JSON", async () => {
    const worker = await mf.getWorker("a");
    const health = await worker.fetch("http://localhost:3000/api");
    expect(await health.json()).toMatchObject({
      message: "ok",
      data: { version: "a" },
    });
    const first = await worker.fetch("http://localhost:3000/api/PSAS/");
    expect(first.status).toBe(200);
    const tag = first.headers.get("etag") ?? "";
    expect(tag).toMatch(/^W\/"V/);
    const headers = { "if-none-match": tag, "cache-control": "max-age=0" };
    expect(
      (await worker.fetch("http://localhost:3000/api/psas", { headers }))
        .status,
    ).toBe(304);
    expect(
      (
        await worker.fetch("http://localhost:3000/api/psas", {
          headers: { ...headers, "cache-control": "no-cache" },
        })
      ).status,
    ).toBe(200);
    const head = await worker.fetch("http://localhost:3000/api/psas", {
      method: "HEAD",
    });
    expect(head.headers.get("etag")).toBe(tag);
    expect(await head.text()).toBe("");
    const preflight = await worker.fetch("http://localhost:3000/api/results", {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-headers": "authorization,content-type",
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
    expect(preflight.headers.get("access-control-allow-headers")).toBe(
      "authorization,content-type",
    );
    const missing = await worker.fetch("http://localhost:3000/api/unknown");
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({
      message: "Unknown request URL (GET: /unknown)",
      data: null,
    });
  });

  it("serves only retained OpenAPI and keeps private editor assets out of production", async () => {
    const worker = await mf.getWorker("a");
    const docs = await worker.fetch(
      "http://localhost:3000/api/docs/internal.json",
    );
    expect(docs.status).toBe(200);
    const api = (await docs.json()) as {
      paths: Record<string, unknown>;
      servers: { url: string }[];
    };
    expect(api.servers[0]?.url).toBe("/api");
    expect(api.paths).toHaveProperty("/ape-keys");
    expect(api.paths).not.toHaveProperty("/configs");
    expect(api.paths).not.toHaveProperty("/users/signup");
    const html = await worker.fetch("http://localhost:3000/api/docs");
    const document = await html.text();
    expect(document).toContain('spec-url="/api/docs/public.json"');
    expect(document).toContain("/redoc/v2.5.4/bundles/redoc.standalone.js");
    expect(document).toContain('integrity="sha384-');
    expect(html.headers.get("content-security-policy")).toContain(
      "https://cdn.redocly.com",
    );
    for (const path of [
      "/api/configure",
      "/api/configure/script.js",
      "/configure/script.js",
    ]) {
      const response = await worker.fetch(`http://localhost:3000${path}`);
      expect(response.status, path).toBe(404);
      expect(await response.text()).not.toContain("Export Configuration");
    }
  });

  it("preserves ApeKey authentication and cookie origin checks on old-tab mutations", async () => {
    const session = await seedSession(mf, "a");
    const db = await mf.getD1Database("DB", "a");
    const data = {
      uid: session.uid,
      name: "HttpFixture",
      email: "http@example.test",
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
        data.name,
        data.name.toLowerCase(),
        data.email,
        JSON.stringify(data),
      )
      .run();
    await enableConfiguration(mf, "a", "$.apeKeys", {
      endpointsEnabled: true,
      acceptKeys: true,
      maxKeysPerUser: 5,
    });
    const worker = await mf.getWorker("a");
    const headers = {
      authorization: `Bearer ${session.token}`,
      "content-type": "application/json",
    };
    const generated = await worker.fetch("http://localhost:3000/api/ape-keys", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "fixture", enabled: true }),
    });
    expect(generated.status, await generated.clone().text()).toBe(200);
    const key = AddApeKeyResponseSchema.parse(await generated.json()).data
      .apeKey;
    const stats = await worker.fetch(
      'http://localhost:3000/api/users/stats?client="web"',
      { headers: { authorization: `ApeKey ${key}` } },
    );
    expect(stats.status, await stats.clone().text()).toBe(200);
    expect(await stats.text()).not.toContain(session.token);
    const blocked = await worker.fetch("http://localhost:3000/api/configs", {
      method: "PATCH",
      headers: {
        cookie: session.cookie,
        "content-type": "application/json",
        origin: "https://foreign.example",
      },
      body: JSON.stringify({ theme: "nord" }),
    });
    expect(blocked.status).toBe(403);
    const saved = await worker.fetch("http://localhost:3000/api/configs", {
      method: "PATCH",
      headers: {
        cookie: session.cookie,
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ theme: "nord" }),
    });
    expect(saved.status, await saved.clone().text()).toBe(200);
    expect(
      await db
        .prepare(
          "SELECT json_extract(data,'$.theme') AS theme FROM configs WHERE uid=?",
        )
        .bind(session.uid)
        .first("theme"),
    ).toBe("nord");
  });

  it("maps malformed, compressed, oversized and unsupported bodies to stable HTTP errors", async () => {
    const worker = await mf.getWorker("a");
    const { gzipSync } = await import("node:zlib");
    for (const [body, extra, status] of [
      ["{", {}, 400],
      ["true", {}, 400],
      [gzipSync("x".repeat(102_401)), { "content-encoding": "gzip" }, 413],
      ["{}", { "content-encoding": "unknown" }, 415],
    ] as const) {
      const response = await worker.fetch("http://localhost:3000/api/results", {
        method: "POST",
        headers: { "content-type": "application/json", ...extra },
        body,
      });
      expect(response.status).toBe(status);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(await response.json()).toHaveProperty("message");
    }
  });
});
