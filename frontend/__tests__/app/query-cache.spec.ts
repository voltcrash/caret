import { QueryClient } from "@tanstack/solid-query";
import { afterEach, expect, it, vi } from "vite-plus/test";

import { createAccountDataOwner } from "../../src/app/account-data";
import {
  createActorQueryCache,
  type QueryCacheStorage,
  type ActorQueryCache,
  type StoredQueryCache,
} from "../../src/app/query-cache.client";
import { getDefaultSnapshot } from "../../src/ts/constants/default-snapshot";
import { ModifiableTestActivityCalendar } from "../../src/ts/elements/test-activity-calendar";

const disposals: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposals.splice(0)) dispose();
});

function storage(): QueryCacheStorage {
  let saved: StoredQueryCache | undefined;
  return {
    read: vi.fn(async () => saved),
    write: vi.fn(async (value: StoredQueryCache) => {
      saved = structuredClone(value);
    }),
    clear: vi.fn(async () => {
      saved = undefined;
    }),
  };
}

function app(
  store: QueryCacheStorage,
  buster = "build:1",
): {
  queryClient: QueryClient;
  account: ReturnType<typeof createAccountDataOwner>;
  cache: ActorQueryCache;
  key: (kind: string) => unknown[];
  dispose: () => void;
} {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const account = createAccountDataOwner(queryClient);
  const cache = createActorQueryCache({
    queryClient,
    account,
    storage: store,
    buster,
  });
  const key = (kind: string): unknown[] => [
    "user",
    account.actor(),
    account.capture().generation,
    kind,
    "web",
  ];
  const dispose = (): void => {
    cache.dispose();
    account.dispose();
    queryClient.clear();
  };
  disposals.push(dispose);
  return { queryClient, account, cache, key, dispose };
}

it("restores only the actor's whitelisted data and reconstructs calendar methods", async () => {
  const store = storage();
  const first = app(store);
  first.account.setActor("a");
  await first.cache.restore();
  const calendar = new ModifiableTestActivityCalendar([1, 2], new Date(), 1);
  first.queryClient.setQueryData(first.key("account"), {
    ...getDefaultSnapshot(),
    name: "cached",
    testActivity: calendar,
  });
  first.queryClient.setQueryData(first.key("results"), [
    { _id: "cached-result" },
  ]);
  first.queryClient.setQueryData(["public", "profile", "name", "web"], {
    name: "profile",
  });
  first.queryClient.setQueryData(["auth", "session"], { secret: "excluded" });
  first.queryClient.setQueryData(first.key("unknown-private-query"), {
    secret: "excluded",
  });
  first.queryClient.setQueryData(["user", "b", 1, "account"], {
    name: "other",
  });
  await first.cache.save();
  expect((await store.read())?.client.queries).toHaveLength(3);
  const persisted = await store.read();
  if (persisted === undefined) throw new Error("missing cache");
  first.dispose();

  const next = app(store);
  // A new document can have a different account generation.
  next.account.setActor("temporary");
  next.account.setActor("a");
  // The temporary identity intentionally clears disk; put the saved entry back.
  await next.cache.clear();
  await store.write(persisted);
  await next.cache.restore();
  const snapshot = next.queryClient.getQueryData<
    ReturnType<typeof getDefaultSnapshot>
  >(next.key("account"));
  expect(snapshot?.name).toBe("cached");
  expect(snapshot?.testActivity).toBeInstanceOf(ModifiableTestActivityCalendar);
  expect(snapshot?.testActivity?.getTotalTests()).toBe(
    calendar.getTotalTests(),
  );
  snapshot?.testActivity?.increment(new Date());
  expect(next.queryClient.getQueryData(next.key("results"))).toEqual([
    { _id: "cached-result" },
  ]);
  expect(
    next.queryClient.getQueryState(next.key("results"))?.isInvalidated,
  ).toBe(true);
  expect(
    next.queryClient.getQueryData(["public", "profile", "name", "web"]),
  ).toEqual({ name: "profile" });
  expect(next.queryClient.getQueryData(["auth", "session"])).toBeUndefined();
});

it.each(["actor", "build", "age"])(
  "discards an incompatible %s cache",
  async (reason) => {
    const store = storage();
    const first = app(store);
    first.account.setActor("a");
    await first.cache.restore();
    first.queryClient.setQueryData(first.key("results"), [{ _id: "private" }]);
    await first.cache.save();
    first.dispose();
    const saved = await store.read();
    if (saved === undefined) throw new Error("missing cache");
    if (reason === "age") saved.timestamp = 0;
    const next = app(store, reason === "build" ? "build:2" : "build:1");
    next.account.setActor(reason === "actor" ? "b" : "a");
    await next.cache.restore();
    expect(next.queryClient.getQueryData(next.key("results"))).toBeUndefined();
    expect(store.clear).toHaveBeenCalled();
  },
);

it.each(["switch", "clear"])(
  "never hydrates a delayed restore after %s",
  async (transition) => {
    const store = storage();
    const first = app(store);
    first.account.setActor("a");
    await first.cache.restore();
    first.queryClient.setQueryData(first.key("results"), [{ _id: "private" }]);
    await first.cache.save();
    first.dispose();
    const delayed = Promise.withResolvers<StoredQueryCache | undefined>();
    const next = app({ ...store, read: async () => await delayed.promise });
    next.account.setActor("a");
    const restore = next.cache.restore();
    await Promise.resolve();
    if (transition === "switch") next.account.setActor("b");
    else void next.cache.clear();
    delayed.resolve(await store.read());
    await restore;
    expect(next.cache.ready()).toBe(false);
    await next.cache.clear();
    expect(next.queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(await store.read()).toBeUndefined();
  },
);

it("retains current-document SSR profiles on initial actor selection, then removes them on switch", () => {
  const next = app(storage());
  const key = ["public", "profile", "name", "web"];
  next.queryClient.setQueryData(key, { name: "SSR" });
  next.account.setActor("a");
  expect(next.queryClient.getQueryData(key)).toEqual({ name: "SSR" });
  next.account.setActor("b");
  expect(next.queryClient.getQueryData(key)).toBeUndefined();
});

it("serializes sign-out clearing after an already-running write, and never saves guests", async () => {
  const store = storage();
  const writing = Promise.withResolvers<undefined>();
  const started = Promise.withResolvers<undefined>();
  const next = app({
    ...store,
    write: async (value) => {
      started.resolve(undefined);
      await writing.promise;
      await store.write(value);
    },
  });
  next.account.setActor("a");
  await next.cache.restore();
  next.queryClient.setQueryData(next.key("results"), [{ _id: "private" }]);
  const save = next.cache.save();
  await started.promise;
  next.account.setActor(null);
  writing.resolve(undefined);
  await save;
  await next.cache.save();
  expect(await store.read()).toBeUndefined();
  expect(store.write).toHaveBeenCalledOnce();
});

it("falls back to network readiness when IndexedDB is unavailable", async () => {
  const next = app({
    read: async () => {
      throw new Error("denied");
    },
    write: async () => {
      throw new Error("quota");
    },
    clear: async () => {
      throw new Error("denied");
    },
  });
  next.account.setActor("a");
  await next.cache.restore();
  expect(next.cache.ready()).toBe(true);
  await expect(next.cache.save()).resolves.toBeUndefined();
  await expect(next.cache.clear()).resolves.toBeUndefined();
});
