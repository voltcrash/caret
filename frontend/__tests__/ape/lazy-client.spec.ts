import { expect, it, vi } from "vite-plus/test";
import { lazyClient } from "../../src/ts/ape/lazy-client";
import { createAccountDataOwner } from "../../src/app/account-data";
import { createQueryClient } from "../../src/app/query-client";

it("loads on first request and shares initialization without merging requests", async () => {
  const get = vi.fn(async (id: string) => id);
  const load = vi.fn(async () => ({ get }));
  const client = lazyClient(load);
  expect(client.get).toBe(client.get);
  expect(load).not.toHaveBeenCalled();
  expect(
    await Promise.all([client.get("first"), client.get("second")]),
  ).toEqual(["first", "second"]);
  expect(load).toHaveBeenCalledOnce();
  expect(get.mock.calls).toEqual([["first"], ["second"]]);
  expect(await Promise.resolve(client)).toBe(client);
});

it("rejects old actor responses even when the endpoint ignores abort", async () => {
  const queryClient = createQueryClient();
  const account = createAccountDataOwner(queryClient);
  account.setActor("a");
  let finish!: (value: string) => void;
  const endpoint = vi.fn(
    async (_request?: { fetchOptions?: { signal?: AbortSignal } }) =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const client = lazyClient(async () => ({ get: endpoint }), account.capture);
  const pending = client.get();
  await vi.waitFor(() => expect(endpoint).toHaveBeenCalledOnce());
  const signal = endpoint.mock.calls[0]?.[0]?.fetchOptions?.signal;
  account.setActor("b");
  expect(signal?.aborted).toBe(true);
  const stale = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  finish("a's data");
  await stale;
  account.dispose();
  queryClient.clear();
});

it("never sends queued private work after an actor changes during chunk loading", async () => {
  const queryClient = createQueryClient();
  const account = createAccountDataOwner(queryClient);
  account.setActor("a");
  const endpoint = vi.fn(async () => "ok");
  let loaded!: (client: { save: typeof endpoint }) => void;
  const client = lazyClient(
    async () =>
      new Promise<{ save: typeof endpoint }>((resolve) => {
        loaded = resolve;
      }),
    account.capture,
  );
  const pending = expect(client.save()).rejects.toMatchObject({
    name: "AbortError",
  });
  account.setActor("b");
  loaded({ save: endpoint });
  await pending;
  expect(endpoint).not.toHaveBeenCalled();
  account.dispose();
  queryClient.clear();
});

it("retries failed chunk loads while retaining a successfully loaded client", async () => {
  const get = vi.fn(async () => "ok");
  const load = vi
    .fn(async () => ({ get }))
    .mockRejectedValueOnce(new Error("chunk missing"));
  const client = lazyClient(load);
  await expect(client.get()).rejects.toThrow("chunk missing");
  await expect(client.get()).resolves.toBe("ok");
  await expect(client.get()).resolves.toBe("ok");
  expect(load).toHaveBeenCalledTimes(2);
});
