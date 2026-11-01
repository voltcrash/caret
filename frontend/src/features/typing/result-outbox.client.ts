import { openDB } from "idb";
import { createSignal } from "solid-js";
import { createAccountOwned, captureAccount } from "../../app/account-scope";
import type { CompletedEvent } from "@caret/schemas/results";
import type { WebLog } from "@caret/typing-engine/text";

export type PendingResult = { result: CompletedEvent; eventLog?: WebLog };
export type OutboxStorage = {
  read: () => Promise<PendingResult[]>;
  write: (entries: PendingResult[]) => Promise<void>;
};

/** Serialize storage updates so an acknowledgement cannot overtake an enqueue. */
export function createResultOutbox(storage: OutboxStorage): {
  entries: () => PendingResult[];
  load: () => Promise<void>;
  add: (entry: PendingResult) => Promise<void>;
  remove: (hash: string) => Promise<void>;
  clear: () => Promise<void>;
} {
  const [entries, setEntries] = createSignal<PendingResult[]>([]);
  let initialized = false;
  let loading: Promise<void> | undefined;
  let writes = Promise.resolve();
  const load = async (): Promise<void> => {
    if (initialized) return;
    loading ??= storage
      .read()
      .then((stored) => {
        const merged = new Map(
          [...stored, ...entries()].map((entry) => [entry.result.hash, entry]),
        );
        setEntries([...merged.values()]);
        initialized = true;
        return undefined;
      })
      .finally(() => {
        loading = undefined;
      });
    await loading;
  };
  const persist = async (): Promise<void> => {
    const snapshot = structuredClone(entries());
    const next = writes.then(async () => await storage.write(snapshot));
    writes = next.catch(() => undefined);
    await next;
  };
  return {
    entries,
    load,
    add: async (entry: PendingResult) => {
      let failed: Error | undefined;
      try {
        await load();
      } catch (error) {
        failed =
          error instanceof Error
            ? error
            : new Error("Pending result storage unavailable");
      }
      if (!entries().some((item) => item.result.hash === entry.result.hash)) {
        setEntries([...entries(), structuredClone(entry)]);
      }
      if (failed !== undefined) throw failed;
      await persist();
    },
    remove: async (hash: string) => {
      await load();
      setEntries(entries().filter((item) => item.result.hash !== hash));
      await persist();
    },
    clear: async () => {
      await load();
      setEntries([]);
      await persist();
    },
  };
}

export function createOutboxStorage(actor: string | null): OutboxStorage {
  let known = new Set<string>();
  const access = async <T>(
    run: (db: Awaited<ReturnType<typeof openDB>>) => Promise<T>,
  ): Promise<T> => {
    const db = await openDB("caret-result-outbox", 1, {
      upgrade: (database) => {
        database.createObjectStore("pending");
      },
    });
    try {
      return await run(db);
    } finally {
      db.close();
    }
  };
  return {
    read: async () => {
      if (actor === null) return [];
      const stored = await access(
        async (db) =>
          ((await db.get("pending", actor)) as PendingResult[] | undefined) ??
          [],
      );
      known = new Set(stored.map((entry) => entry.result.hash));
      return stored;
    },
    write: async (entries) => {
      if (actor === null) return;
      await access(async (db) => {
        const transaction = db.transaction("pending", "readwrite");
        const stored =
          ((await transaction.store.get(actor)) as
            | PendingResult[]
            | undefined) ?? [];
        // Apply this owner's delta atomically. A second tab's unrelated saves
        // must survive even when both tabs loaded the same older snapshot.
        const merged = new Map(
          stored
            .filter((entry) => !known.has(entry.result.hash))
            .map((entry) => [entry.result.hash, entry]),
        );
        for (const entry of entries) merged.set(entry.result.hash, entry);
        await transaction.store.put([...merged.values()], actor);
        await transaction.done;
        known = new Set(entries.map((entry) => entry.result.hash));
      });
    },
  };
}

export const resultOutbox = createAccountOwned(() =>
  createResultOutbox(createOutboxStorage(captureAccount().actor)),
);
