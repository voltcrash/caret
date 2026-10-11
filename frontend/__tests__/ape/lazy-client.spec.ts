import { expect, it, vi } from "vite-plus/test";
import { lazyClient } from "../../src/ts/ape/lazy-client";

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
