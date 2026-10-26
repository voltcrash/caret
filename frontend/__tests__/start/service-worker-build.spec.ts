import { afterAll, beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { createWorkerd } from "./workerd";

const client = resolve(import.meta.dirname, "../../dist/start/client");

/** Evaluates only the leading configuration statement of the built worker. */
function builtConfig(): { buildId: string; precache: string[] } {
  const source = readFileSync(resolve(client, "sw.js"), "utf8");
  const statement = /^var __CARET_SW__\s*=\s*[^;]+;/.exec(source)?.[0];
  if (statement === undefined) throw new Error("Missing worker configuration");
  const context: { __CARET_SW__?: { buildId: string; precache: string[] } } =
    {};
  runInNewContext(statement, context);
  if (context.__CARET_SW__ === undefined) throw new Error("Not evaluated");
  return context.__CARET_SW__;
}

describe("built Start service worker", () => {
  it("limits concurrent offline downloads while retaining the complete cache", async () => {
    const config = builtConfig();
    const handlers = new Map<
      string,
      (event: { waitUntil: (work: Promise<void>) => void }) => void
    >();
    const pending: (() => void)[] = [];
    const put = vi.fn(async () => undefined);
    const fetched: string[] = [];
    const source = readFileSync(resolve(client, "sw.js"), "utf8");
    runInNewContext(source, {
      URL,
      location: { origin: "https://oxytype.test" },
      registration: { active: null },
      caches: {
        open: async () => ({ put }),
        match: async () => undefined,
      },
      fetch: async (url: string) =>
        new Promise<Response>((resolve) => {
          fetched.push(url);
          pending.push(() =>
            resolve(
              new Response("fixture", {
                headers: { "X-Caret-Build": config.buildId },
              }),
            ),
          );
        }),
      skipWaiting: async () => undefined,
      addEventListener: (
        type: string,
        handler: (event: { waitUntil: (work: Promise<void>) => void }) => void,
      ) => handlers.set(type, handler),
    });
    let work: Promise<void> | undefined;
    let done = false;
    handlers.get("install")?.({
      waitUntil: (pending) => {
        work = pending;
      },
    });
    if (work === undefined) throw new Error("Missing install event");
    void work.then(() => {
      done = true;
    });
    for (let round = 0; !done && round < config.precache.length + 2; round++) {
      await new Promise((resolve) => setImmediate(resolve));
      expect(pending.length).toBeLessThanOrEqual(4);
      for (const complete of pending.splice(0)) complete();
    }
    expect(done).toBe(true);
    await work;
    expect(fetched).toHaveLength(config.precache.length + 1);
    expect(put).toHaveBeenCalledTimes(config.precache.length + 1);
  });

  it("belongs to the same build as version.json and the client", () => {
    const { version } = JSON.parse(
      readFileSync(resolve(client, "version.json"), "utf8"),
    ) as { version: string };
    expect(builtConfig().buildId).toBe(version);
  });

  it("precaches only existing public files, never functions or private routes", () => {
    const { precache } = builtConfig();
    expect(precache.length).toBeGreaterThan(20);
    expect(precache).toContain("/manifest.json");
    expect(precache.some((path) => /^\/assets\/.+\.css$/.test(path))).toBe(
      true,
    );
    expect(
      precache.some((path) => path.startsWith("/languages/english.json?v=")),
    ).toBe(true);
    for (const path of precache) {
      expect(path).not.toMatch(/^\/(?:api|_serverFn)(?:\/|$)/);
      expect(existsSync(resolve(client, `.${path.split("?")[0]}`)), path).toBe(
        true,
      );
    }
  });

  describe("delivery headers", () => {
    let mf: Awaited<ReturnType<typeof createWorkerd>>;
    beforeAll(async () => {
      mf = await createWorkerd();
    });
    afterAll(async () => await mf?.dispose());

    it("preloads the verified default language directly from the typing document", async () => {
      const path = builtConfig().precache.find((path) =>
        path.startsWith("/languages/english.json?v="),
      );
      expect(path).toBeDefined();
      const response = await mf.dispatchFetch("http://localhost:3000/");
      const html = await response.text();
      const link = [...html.matchAll(/<link\b[^>]*>/g)]
        .map((match) => match[0])
        .find((tag) => tag.includes(`href="${path}"`));
      expect(link).toContain('rel="preload"');
      expect(link).toContain('as="fetch"');
      expect(link).toContain('crossorigin="anonymous"');
    });

    it.each([
      ["/sw.js", "no-cache"],
      ["/version.json", "no-cache"],
    ])("revalidates %s instead of caching it", async (path, policy) => {
      const response = await mf.dispatchFetch(`http://localhost:3000${path}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe(policy);
      await response.arrayBuffer();
    });
  });

  it("precaches the matching browser engine and delivers Wasm with compilation headers", async () => {
    const files = builtConfig().precache;
    expect(files.some((path) => /\/browser\.client-.+\.js$/.test(path))).toBe(
      true,
    );
    const wasm = files.filter((path) => path.endsWith(".wasm"));
    expect(wasm).toHaveLength(1);
    const runtime = await createWorkerd();
    try {
      const html = await (
        await runtime.dispatchFetch("http://localhost:3000/")
      ).text();
      const preload = [...html.matchAll(/<link\b[^>]*>/g)]
        .map((match) => match[0])
        .find((tag) => tag.includes(`href="${wasm[0]}"`));
      expect(preload).toContain('rel="preload"');
      expect(preload).toContain('as="fetch"');
      expect(preload).toContain('type="application/wasm"');
      expect(preload).toContain('crossorigin="anonymous"');
      const response = await runtime.dispatchFetch(
        `http://localhost:3000${wasm[0]}`,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/wasm");
      expect(response.headers.get("Cache-Control")).toContain("immutable");
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(
        new Uint8Array(readFileSync(resolve(client, `.${wasm[0]}`))),
      );
    } finally {
      await runtime.dispose();
    }
  });

  it("is a self-contained classic script without backend code", () => {
    const source = readFileSync(resolve(client, "sw.js"), "utf8");
    expect(source).not.toMatch(/\bimport\s*[({"'`]|^export\s/m);
    for (const marker of ["withRuntime", "sqlite_master", "BETTER_AUTH"]) {
      expect(source).not.toContain(marker);
    }
  });
});
