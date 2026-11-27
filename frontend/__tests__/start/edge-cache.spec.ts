import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { withRuntime, type WorkerEnv } from "@caret/backend/runtime";
import {
  EDGE_CACHE_HIT,
  edgeCacheKey,
  matchEdgeCache,
  storeEdgeCache,
} from "../../src/server/edge-cache.server";

function installMemoryCache(): {
  stored: Map<string, Response>;
  cancelSpies: ReturnType<typeof vi.fn>[];
} {
  const stored = new Map<string, Response>();
  const cancelSpies: ReturnType<typeof vi.fn>[] = [];
  const cache = {
    async put(key: Request, response: Response): Promise<void> {
      stored.set(key.url, response);
    },
    async match(key: Request): Promise<Response | undefined> {
      const entry = stored.get(key.url);
      if (entry === undefined) return undefined;
      const bodyText = await entry.clone().text();
      const cancel = vi.fn();
      cancelSpies.push(cancel);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(bodyText));
          controller.close();
        },
        cancel,
      });
      return new Response(stream, {
        status: entry.status,
        headers: entry.headers,
      });
    },
  };
  vi.stubGlobal("caches", {
    open: async () => cache,
  });
  return { stored, cancelSpies };
}

describe("edge cache CORS and 304 handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("strips Access-Control-Allow-Origin on store and reapplies it per request origin", async () => {
    const { stored } = installMemoryCache();
    const env = {
      MODE: "production",
      FRONTEND_URL: "https://caret.test",
    } as unknown as WorkerEnv;
    const url = "https://caret.test/api/public/typingStats";
    const key = edgeCacheKey(new Request(url));
    if (key === undefined) throw new Error("Expected cache key");

    const pending: Promise<unknown>[] = [];
    storeEdgeCache(
      key,
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=60",
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": "11",
          ETag: 'W/"v1"',
          Vary: "Origin",
          "Access-Control-Allow-Origin": "https://caret.test",
        },
      }),
      {
        waitUntil: (promise) => {
          pending.push(promise);
        },
      },
    );
    await Promise.all(pending);

    expect(stored.get(url)?.headers.has("Access-Control-Allow-Origin")).toBe(
      false,
    );

    await withRuntime(env, async () => {
      const foreignHit = await matchEdgeCache(
        new Request(url, { headers: { origin: "https://evil.example" } }),
      );
      expect(foreignHit?.status).toBe(200);
      expect(foreignHit?.headers.get(EDGE_CACHE_HIT)).toBe("hit");
      expect(foreignHit?.headers.get("Access-Control-Allow-Origin")).toBeNull();
      await foreignHit?.body?.cancel();

      const allowedHit = await matchEdgeCache(
        new Request(url, { headers: { origin: "https://caret.test" } }),
      );
      expect(allowedHit?.status).toBe(200);
      expect(allowedHit?.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://caret.test",
      );
      await allowedHit?.body?.cancel();
    });
  });

  it("cancels cached response body and strips entity headers on 304 hits", async () => {
    const { cancelSpies } = installMemoryCache();
    const env = {
      MODE: "production",
      FRONTEND_URL: "https://caret.test",
    } as unknown as WorkerEnv;
    const url = "https://caret.test/api/psas";
    const key = edgeCacheKey(new Request(url));
    if (key === undefined) throw new Error("Expected cache key");

    const pending: Promise<unknown>[] = [];
    storeEdgeCache(
      key,
      new Response("[]", {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=60",
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": "2",
          ETag: 'W/"etag-1"',
          Vary: "Origin",
        },
      }),
      {
        waitUntil: (promise) => {
          pending.push(promise);
        },
      },
    );
    await Promise.all(pending);

    await withRuntime(env, async () => {
      const notModified = await matchEdgeCache(
        new Request(url, {
          headers: {
            "if-none-match": 'W/"etag-1"',
            origin: "https://caret.test",
          },
        }),
      );
      expect(notModified?.status).toBe(304);
      expect(notModified?.headers.get("Content-Type")).toBeNull();
      expect(notModified?.headers.get("Content-Length")).toBeNull();
      expect(notModified?.headers.get("ETag")).toBe('W/"etag-1"');
      expect(notModified?.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://caret.test",
      );
      expect(cancelSpies[0]).toHaveBeenCalledTimes(1);
    });
  });
});
