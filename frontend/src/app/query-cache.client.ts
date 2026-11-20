import {
  dehydrate,
  hashKey,
  hydrate,
  type DehydratedState,
  type QueryClient,
  type QueryKey,
} from "@tanstack/solid-query";
import { openDB, type IDBPDatabase } from "idb";
import { createSignal, onCleanup, untrack } from "solid-js";

import {
  ModifiableTestActivityCalendar,
  type StoredTestActivity,
} from "../ts/elements/test-activity-calendar";
import type { AccountData } from "../data/queries/account";
import type { AccountDataOwner } from "./account-data";
import { createAppOwned, requireApplication } from "./application";

type StoredAccount = Omit<AccountData, "testActivity"> & {
  testActivity?: StoredTestActivity;
};
const defaultMaxAge = 7 * 24 * 60 * 60 * 1_000;

export type StoredQueryCache = {
  actor: string;
  buster: string;
  timestamp: number;
  client: DehydratedState;
};

export type QueryCacheStorage = {
  read: () => Promise<StoredQueryCache | undefined>;
  write: (value: StoredQueryCache) => Promise<void>;
  clear: () => Promise<void>;
};

/** One actor per database. Open lazily; denied/unavailable storage is optional. */
function createIndexedDbStorage(): QueryCacheStorage {
  const database = async (): Promise<IDBPDatabase> =>
    await openDB("caret-query-cache", 1, {
      upgrade: (db) => db.createObjectStore("cache"),
    });
  const run = async <T>(
    action: (db: Awaited<ReturnType<typeof database>>) => Promise<T>,
  ): Promise<T | undefined> => {
    if (typeof indexedDB === "undefined") return undefined;
    const db = await database();
    try {
      return await action(db);
    } finally {
      db.close();
    }
  };
  return {
    read: async () =>
      await run(
        async (db) =>
          (await db.get("cache", "current")) as StoredQueryCache | undefined,
      ),
    write: async (value) => {
      await run(async (db) => await db.put("cache", value, "current"));
    },
    clear: async () => {
      await run(async (db) => await db.clear("cache"));
    },
  };
}

function isProfile(key: QueryKey): boolean {
  return key[0] === "public" && key[1] === "profile";
}

/** Persist only account/history and public profiles; never auth, config or mutations. */
function isPersisted(
  key: QueryKey,
  actor: string,
  generation: number,
): boolean {
  return (
    isProfile(key) ||
    (key[0] === "user" &&
      key[1] === actor &&
      key[2] === generation &&
      (key[3] === "account" || key[3] === "results"))
  );
}

/** Actor-scoped stale-while-revalidate, using Query hydration and the existing idb dependency. */
export type ActorQueryCache = {
  ready: () => boolean;
  restore: () => Promise<void>;
  clear: () => Promise<void>;
  save: () => Promise<void>;
  dispose: () => void;
};

export function createActorQueryCache(options: {
  queryClient: QueryClient;
  account: AccountDataOwner;
  storage: QueryCacheStorage;
  buster: string;
  maxAge?: number;
}): ActorQueryCache {
  const { queryClient, account, storage, buster } = options;
  type CacheState =
    | { phase: "idle" | "disposed" }
    | { phase: "restoring"; task: Promise<void> }
    | { phase: "ready"; unsubscribe: () => void };
  const [state, setState] = createSignal<CacheState>({ phase: "idle" });
  const ready = (): boolean => state().phase === "ready";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let revision = 0;
  let dataRevision = 0;
  let savedRevision = -1;
  // Serialize writes/clears. A late save can never overtake sign-out's clear.
  let queue = Promise.resolve();
  const enqueue = async (action: () => Promise<void>): Promise<void> => {
    const task = queue.then(action);
    queue = task.catch(() => undefined);
    return queue;
  };
  const stop = (dispose = false): void => {
    revision++;
    dataRevision = 0;
    savedRevision = -1;
    const current = untrack(state);
    if (current.phase === "ready") current.unsubscribe();
    clearTimeout(timer);
    timer = undefined;
    if (current.phase !== "disposed") {
      setState({ phase: dispose ? "disposed" : "idle" });
    }
  };
  const clear = async (): Promise<void> => {
    stop();
    return enqueue(async () => await storage.clear());
  };
  const release = account.onChange((previous) => {
    stop();
    // Initial null → actor must retain that actor's previous document cache.
    if (previous !== null) {
      void clear();
      queryClient.removeQueries({ queryKey: ["public", "profile"] });
    }
  });
  const save = async (): Promise<void> => {
    clearTimeout(timer);
    timer = undefined;
    const lease = account.capture();
    if (!ready() || lease.actor === null) return queue;
    const actor = lease.actor;
    const started = revision;
    return enqueue(async () => {
      if (!lease.isCurrent() || started !== revision) return;
      if (savedRevision === dataRevision) return;
      const savingRevision = dataRevision;
      const client = dehydrate(queryClient, {
        shouldDehydrateMutation: () => false,
        shouldDehydrateQuery: (query) =>
          query.state.data !== undefined &&
          isPersisted(query.queryKey, actor, lease.generation),
      });
      client.queries = client.queries.map((query) => {
        const data = query.state.data as AccountData;
        return {
          ...query,
          // Persist successful data even if its background refresh failed.
          state: {
            ...query.state,
            status: "success",
            error: null,
            data:
              query.queryKey[3] === "account"
                ? {
                    ...data,
                    testActivity: data.testActivity?.toStored(),
                  }
                : query.state.data,
          },
        };
      });
      await storage.write({ actor, buster, timestamp: Date.now(), client });
      if (lease.isCurrent() && started === revision) {
        savedRevision = savingRevision;
      }
    });
  };
  const scheduleSave = (): void => {
    dataRevision++;
    timer ??= setTimeout(() => {
      void save();
    }, 100);
  };
  const restore = async (): Promise<void> => {
    const current = untrack(state);
    if (current.phase === "restoring") return current.task;
    if (current.phase !== "idle") return;
    const lease = account.capture();
    if (lease.actor === null) return Promise.resolve();
    const actor = lease.actor;
    const started = revision;
    const task = enqueue(async () => {
      const stored = await storage.read();
      if (!lease.isCurrent() || started !== revision) return;
      if (stored === undefined) return;
      const age = Date.now() - stored.timestamp;
      const maxAge = options.maxAge ?? defaultMaxAge;
      if (
        stored.actor !== actor ||
        stored.buster !== buster ||
        age < 0 ||
        age > maxAge
      ) {
        await storage.clear();
        return;
      }
      const queries = stored.client.queries
        .filter(
          (query) =>
            isProfile(query.queryKey) ||
            (query.queryKey[0] === "user" &&
              query.queryKey[1] === actor &&
              (query.queryKey[3] === "account" ||
                query.queryKey[3] === "results")),
        )
        .map((query) => {
          const queryKey = isProfile(query.queryKey)
            ? query.queryKey
            : ["user", actor, lease.generation, ...query.queryKey.slice(3)];
          const data = query.state.data as StoredAccount;
          return {
            ...query,
            queryKey,
            queryHash: hashKey(queryKey),
            state: {
              ...query.state,
              isInvalidated: true,
              data:
                queryKey[3] === "account"
                  ? {
                      ...data,
                      testActivity:
                        data.testActivity === undefined
                          ? undefined
                          : ModifiableTestActivityCalendar.fromStored(
                              data.testActivity,
                            ),
                    }
                  : query.state.data,
            },
          };
        });
      hydrate(queryClient, { mutations: [], queries });
    }).then(() => {
      if (!lease.isCurrent() || started !== revision) return;
      const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
        if (
          (event.type === "removed" ||
            (event.type === "updated" &&
              (event.action.type === "success" ||
                event.action.type === "setState"))) &&
          isPersisted(event.query.queryKey as QueryKey, actor, lease.generation)
        ) {
          scheduleSave();
        }
      });
      setState({ phase: "ready", unsubscribe });
      scheduleSave();
      return undefined;
    });
    setState({ phase: "restoring", task });
    return task;
  };
  return {
    ready,
    restore,
    clear,
    save,
    dispose: () => {
      stop(true);
      release();
    },
  };
}

export const accountQueryCache = createAppOwned(() => {
  const app = requireApplication();
  const cache = createActorQueryCache({
    account: app.accountData,
    queryClient: app.queryClient,
    storage: createIndexedDbStorage(),
    buster: `${import.meta.env.CARET_BUILD_ID}:account-cache-v1`,
  });
  const flush = (): void => {
    void cache.save();
  };
  window.addEventListener("pagehide", flush);
  onCleanup(() => {
    window.removeEventListener("pagehide", flush);
    cache.dispose();
  });
  return cache;
});
