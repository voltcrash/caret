import { afterEach, beforeEach, expect, it } from "vite-plus/test";

import { requireApplication } from "../../src/app/application";
import {
  createActorQueryCache,
  type StoredQueryCache,
} from "../../src/app/query-cache.client";
import {
  getResults,
  waitForResultsReady,
} from "../../src/ts/collections/results/store";
import { queryKeys } from "../../src/ts/collections/results/keys";
import { normalizeResult } from "../../src/ts/collections/results/normalize";
import { getDefaultSnapshot } from "../../src/ts/constants/default-snapshot";
import { getAccountQueryOptions } from "../../src/ts/queries/account";
import { setUserId } from "../../src/ts/states/core";
import {
  mockOperation,
  ok,
  operationCalls,
  resetOperations,
} from "../__harness__/operations";

beforeEach(() => {
  resetOperations();
  setUserId("loading");
});
afterEach(() => {
  setUserId(null);
  requireApplication().queryClient.clear();
});

it("starts history while the tags/account request is still pending", async () => {
  const tags = Promise.withResolvers<ReturnType<typeof ok>>();
  mockOperation("users.get", async () => await tags.promise);
  mockOperation("results.get", () => ok([]));
  const loading = waitForResultsReady();
  await expect
    .poll(() => operationCalls.mock.calls.map(([id]) => id))
    .toContain("results.get");
  tags.resolve(ok({ name: "loading", tags: [] }));
  await loading;
  expect(getResults()).toEqual([]);
});

it("publishes persisted collection rows before background requests finish", async () => {
  const app = requireApplication();
  let saved: StoredQueryCache | undefined;
  const storage = {
    read: async () => saved,
    write: async (value: StoredQueryCache) => {
      saved = structuredClone(value);
    },
    clear: async () => {
      saved = undefined;
    },
  };
  const first = createActorQueryCache({
    account: app.accountData,
    queryClient: app.queryClient,
    storage,
    buster: "test",
  });
  await first.restore();
  app.queryClient.setQueryData(getAccountQueryOptions().queryKey, {
    ...getDefaultSnapshot(),
    name: "cached",
    tags: [],
  });
  const row = normalizeResult({
    _id: "cached",
    uid: "loading",
    timestamp: Date.now(),
    mode: "time",
    mode2: "15",
    wpm: 80,
    rawWpm: 80,
    acc: 100,
    consistency: 100,
    testDuration: 15,
    charStats: [100, 0, 0, 0],
    keyConsistency: 100,
  });
  app.queryClient.setQueryData(queryKeys.root(), [row]);
  await first.save();
  first.dispose();
  // Simulate a new document's actor generation and empty in-memory cache.
  setUserId(null);
  setUserId("loading");
  const next = createActorQueryCache({
    account: app.accountData,
    queryClient: app.queryClient,
    storage,
    buster: "test",
  });
  const network = Promise.withResolvers<ReturnType<typeof ok>>();
  mockOperation("results.get", async () => await network.promise);
  mockOperation("users.get", () => ok({ name: "refreshed", tags: [] }));
  try {
    await next.restore();
    await waitForResultsReady();
    expect(getResults().map((result) => result._id)).toEqual(["cached"]);
    expect(app.queryClient.getQueryState(queryKeys.root())?.fetchStatus).toBe(
      "fetching",
    );
    network.resolve(ok([]));
    await expect.poll(() => getResults()).toEqual([]);
  } finally {
    network.resolve(ok([]));
    next.dispose();
  }
});
