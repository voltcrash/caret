import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import { createWorkerd, seedSession } from "./workerd";

describe("retired API keys in the built Worker", () => {
  let mf: Awaited<ReturnType<typeof createWorkerd>>;
  beforeAll(async () => {
    mf = await createWorkerd();
  });
  afterAll(async () => await mf?.dispose());

  it("returns JSON 404 for every former key-management method, including authenticated requests", async () => {
    const session = await seedSession(mf, "a");
    const worker = await mf.getWorker("a");
    for (const authorization of [
      undefined,
      `Bearer ${session.token}`,
      "ApeKey retired-key",
    ]) {
      for (const [method, path] of [
        ["GET", "/api/ape-keys"],
        ["POST", "/api/ape-keys"],
        ["PATCH", "/api/ape-keys/retired"],
        ["DELETE", "/api/ape-keys/retired"],
      ]) {
        const response = await worker.fetch(`http://localhost:3000${path}`, {
          method,
          headers: {
            origin: "http://localhost:3000",
            "content-type": "application/json",
            ...(authorization === undefined ? {} : { authorization }),
          },
          ...(method === "GET" ? {} : { body: "{}" }),
        });
        expect(response.status).toBe(404);
        expect(response.headers.get("content-type")).toContain(
          "application/json",
        );
        expect(await response.json()).toHaveProperty(
          "message",
          expect.stringContaining("Unknown request URL"),
        );
      }
    }
  });

  it("rejects legacy key headers on private and public APIs while retaining anonymous public reads", async () => {
    const worker = await mf.getWorker("b");
    for (const path of [
      "/api/users/stats",
      "/api/results",
      "/api/public/typingStats",
    ]) {
      const response = await worker.fetch(`http://localhost:3000${path}`, {
        headers: { authorization: "ApeKey retired-key" },
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        message: "Unknown authentication scheme",
      });
    }
    expect(
      (await worker.fetch("http://localhost:3000/api/public/typingStats"))
        .status,
    ).toBe(200);
  });

  it("omits the feature from configuration and both API specifications", async () => {
    const worker = await mf.getWorker("b");
    const config = await worker.fetch(
      "http://localhost:3000/api/configuration",
    );
    expect(config.status).toBe(200);
    expect(await config.text()).not.toContain("apeKeys");
    for (const path of ["/api/docs/public.json", "/api/docs/internal.json"]) {
      const response = await worker.fetch(`http://localhost:3000${path}`);
      expect(response.status).toBe(200);
      const spec = await response.text();
      expect(spec).not.toMatch(
        /ApeKey|ape-keys|acceptApeKeys|canManageApeKeys/,
      );
      expect(spec).not.toMatch(/"(?:470|471|472|479)"/);
    }
    const publicSpec = await worker.fetch(
      "http://localhost:3000/api/docs/public.json",
    );
    const api = (await publicSpec.json()) as { paths: Record<string, unknown> };
    expect(api.paths).toHaveProperty("/public/typingStats");
    expect(api.paths).not.toHaveProperty("/users/stats");
  });
});
