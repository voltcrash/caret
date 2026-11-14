import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

type FetchEvent = {
  request: { url: string; method: string; mode: string; headers: Headers };
  preloadResponse: Promise<Response | undefined>;
  waitUntil: (work: Promise<unknown>) => void;
  respondWith: (response: Promise<Response>) => void;
};

function worker(
  options: {
    cached?: Response;
    network?: Promise<Response>;
    put?: () => Promise<void>;
  } = {},
): {
  fetch: ReturnType<typeof vi.fn<() => Promise<Response>>>;
  put: ReturnType<typeof vi.fn<() => Promise<void>>>;
  match: ReturnType<typeof vi.fn<() => Promise<Response | undefined>>>;
  background: Promise<unknown>[];
  request: (
    path: string,
    mode?: string,
    preloadResponse?: Promise<Response | undefined>,
  ) => Promise<Response>;
} {
  const source = readFileSync(
    resolve(import.meta.dirname, "../../dist/start/client/sw.js"),
    "utf8",
  );
  const fetch = vi.fn(
    async () => options.network ?? Promise.resolve(new Response("network")),
  );
  const put = vi.fn(options.put ?? (async () => undefined));
  const match = vi.fn(async () => options.cached?.clone());
  let handler: ((event: FetchEvent) => void) | undefined;
  runInNewContext(source, {
    URL,
    Response,
    setTimeout,
    clearTimeout,
    location: { origin: "https://caret.test" },
    caches: { open: async () => ({ match, put }), match },
    fetch,
    addEventListener: (type: string, listener: (event: FetchEvent) => void) => {
      if (type === "fetch") handler = listener;
    },
  });
  const background: Promise<unknown>[] = [];
  return {
    fetch,
    put,
    match,
    background,
    async request(
      path: string,
      mode = "navigate",
      preloadResponse = Promise.resolve<Response | undefined>(undefined),
    ) {
      let response: Promise<Response> | undefined;
      handler?.({
        request: {
          url: `https://caret.test${path}`,
          method: "GET",
          mode,
          headers: new Headers(),
        },
        preloadResponse,
        waitUntil: (work) => {
          background.push(work);
        },
        respondWith: (work) => {
          response = work;
        },
      });
      if (response === undefined) {
        throw new Error("Request was not intercepted");
      }
      return response;
    },
  };
}

afterEach(() => vi.useRealTimers());

describe("slow network service worker", () => {
  it("serves installed typing after 1.5 seconds without waiting for stalled navigation preload", async () => {
    vi.useFakeTimers();
    const pending = Promise.withResolvers<Response>();
    const sw = worker({ cached: new Response("guest shell") });
    const result = sw.request("/?mode=words", "navigate", pending.promise);
    let settled = false;
    void result.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(1499);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await (await result).text()).toBe("guest shell");
    expect(sw.fetch).not.toHaveBeenCalled();
    pending.resolve(new Response("private late response"));
    await Promise.all(sw.background);
    expect(sw.put).not.toHaveBeenCalled();
  });

  it("returns a fast navigation unchanged and clears its deadline", async () => {
    vi.useFakeTimers();
    const sw = worker({ cached: new Response("guest shell") });
    expect(await (await sw.request("/")).text()).toBe("network");
    expect(vi.getTimerCount()).toBe(0);
    expect(sw.match).not.toHaveBeenCalled();
  });

  it("keeps waiting for the network when the shell was evicted", async () => {
    vi.useFakeTimers();
    const pending = Promise.withResolvers<Response>();
    const sw = worker({ network: pending.promise });
    const result = sw.request("/");
    let settled = false;
    void result.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(2000);
    expect(settled).toBe(false);
    pending.resolve(new Response("network"));
    expect(await (await result).text()).toBe("network");
  });

  it.each(["/account", "/api/auth/callback/github", "/_serverFn/session"])(
    "never times out or substitutes the shell for %s",
    async (path) => {
      vi.useFakeTimers();
      const pending = Promise.withResolvers<Response>();
      const sw = worker({ cached: new Response("guest shell") });
      const result = sw.request(path, "navigate", pending.promise);
      let settled = false;
      void result.then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(10_000);
      expect(settled).toBe(false);
      pending.resolve(new Response("private"));
      expect(await (await result).text()).toBe("private");
      expect(sw.fetch).not.toHaveBeenCalled();
      expect(sw.match).not.toHaveBeenCalled();
      expect(sw.put).not.toHaveBeenCalled();
    },
  );

  it("streams a cache miss without waiting for the cache write", async () => {
    const writing = Promise.withResolvers<undefined>();
    const sw = worker({ put: async () => writing.promise });
    expect(
      await (await sw.request("/webfonts/font.woff2", "cors")).text(),
    ).toBe("network");
    expect(sw.put).toHaveBeenCalledOnce();
    writing.resolve(undefined);
    await Promise.all(sw.background);
  });

  it("still delivers downloads when cache storage is full", async () => {
    const sw = worker({
      put: async () => {
        throw new Error("Quota exceeded");
      },
    });
    expect(
      await (await sw.request("/quotes/english.json", "cors")).text(),
    ).toBe("network");
    await expect(Promise.all(sw.background)).resolves.toEqual([undefined]);
  });

  it("serves cached public data immediately while revalidating", async () => {
    const pending = Promise.withResolvers<Response>();
    const sw = worker({
      cached: new Response("cached"),
      network: pending.promise,
    });
    expect(
      await (await sw.request("/layouts/qwerty.json", "cors")).text(),
    ).toBe("cached");
    pending.resolve(new Response("updated"));
    await Promise.all(sw.background);
    expect(sw.put).toHaveBeenCalledOnce();
  });
});
