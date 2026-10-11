import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
const { environment } = vi.hoisted(() => ({
  environment: {
    backendUrl: "https://api.example.test",
    clientVersion: "unit",
    devOffline: false,
  },
}));
vi.mock("virtual:env-config", () => ({ envConfig: environment }));
vi.mock("../../src/ts/states/banners", () => ({ addBanner: vi.fn() }));
import Ape from "../../src/ts/ape";
beforeEach(() => {
  environment.devOffline = false;
});
afterEach(() => vi.unstubAllGlobals());

it("blocks backend requests in frontend-only mode", async () => {
  environment.devOffline = true;
  const fetch = vi.fn<typeof globalThis.fetch>();
  vi.stubGlobal("fetch", fetch);
  expect(await Ape.configuration.get()).toMatchObject({
    status: 503,
    body: { message: expect.stringContaining("frontend-only") },
  });
  expect(fetch).not.toHaveBeenCalled();
});

it("preserves API paths, queries, credentials and client headers after lazy initialization", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(Response.json({ data: { tests: 1 } }));
  vi.stubGlobal("fetch", fetch);
  expect(
    await Ape.public.getTypingStats({ query: { client: "tui" } }),
  ).toMatchObject({ status: 200, body: { data: { tests: 1 } } });
  expect(fetch).toHaveBeenCalledOnce();
  const [url, options] = fetch.mock.calls[0] ?? [];
  expect(url).toBe("https://api.example.test/public/typingStats?client=tui");
  expect(options).toMatchObject({ method: "GET", credentials: "include" });
  expect(new Headers(options?.headers).get("X-Client-Version")).toBe("unit");
  expect(new Headers(options?.headers).get("Accept")).toBe("application/json");
  expect(options?.signal).toBeInstanceOf(AbortSignal);
});
