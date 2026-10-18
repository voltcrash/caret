import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { staleClient } from "../../src/app/release";
import { serverFunctionFetch } from "../../src/features/update/fetch.client";

describe("server-function transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports this tab's build and passes responses through unchanged", async () => {
    const fetch = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetch);
    const response = await serverFunctionFetch("/_serverFn/a", {
      method: "POST",
      headers: { "x-tsr-serverFn": "true" },
    });
    expect(await response.text()).toBe("ok");
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("x-tsr-serverFn")).toBe("true");
    expect(headers.has("X-Client-Version")).toBe(true);
    expect(init.method).toBe("POST");
    expect(staleClient()).toBeUndefined();
  });

  it("marks the tab stale on an unknown-function conflict without retrying", async () => {
    const fetch = vi.fn(
      async () =>
        new Response("Oxytype was updated. Refresh the page to continue.", {
          status: 409,
          headers: { "X-Oxytype-Stale-Client": "1" },
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const response = await serverFunctionFetch("/_serverFn/gone", {
      method: "POST",
    });
    expect(response.status).toBe(409);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(staleClient()).toBe("function");
  });
});
