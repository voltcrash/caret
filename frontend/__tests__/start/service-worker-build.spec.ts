import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { createWorkerd } from "./workerd";

const client = resolve(import.meta.dirname, "../../dist/start/client");

/** Evaluates only the leading configuration statement of the built worker. */
function builtConfig(): { buildId: string; precache: string[] } {
  const source = readFileSync(resolve(client, "sw.js"), "utf8");
  const statement = /^var __OXYTYPE_SW__\s*=\s*[^;]+;/.exec(source)?.[0];
  if (statement === undefined) throw new Error("Missing worker configuration");
  const context: { __OXYTYPE_SW__?: { buildId: string; precache: string[] } } =
    {};
  runInNewContext(statement, context);
  if (context.__OXYTYPE_SW__ === undefined) throw new Error("Not evaluated");
  return context.__OXYTYPE_SW__;
}

describe("built Start service worker", () => {
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

    it.each([
      ["/sw.js", "no-cache"],
      ["/version.json", "no-cache"],
      ["/release.json", "no-store"],
    ])("revalidates %s instead of caching it", async (path, policy) => {
      const response = await mf.dispatchFetch(`http://localhost:3000${path}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe(policy);
      await response.arrayBuffer();
    });
  });

  it("is a self-contained classic script without backend code", () => {
    const source = readFileSync(resolve(client, "sw.js"), "utf8");
    expect(source).not.toMatch(/\bimport\s*[({"'`]|^export\s/m);
    for (const marker of ["withRuntime", "sqlite_master", "BETTER_AUTH"]) {
      expect(source).not.toContain(marker);
    }
  });
});
