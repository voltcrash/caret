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
  let initialized: Promise<void> | undefined;
  let writes = Promise.resolve();
  const load = async (): Promise<void> =>
    (initialized ??= storage
      .read()
      .then((stored) => {
        setEntries(stored);
        return undefined;
      })
      .catch(() => undefined));
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
      await load();
      if (!entries().some((item) => item.result.hash === entry.result.hash)) {
        setEntries([...entries(), structuredClone(entry)]);
      }
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

export const resultOutbox = createAccountOwned(() => {
  const account = captureAccount();
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
  return createResultOutbox({
    read: async () =>
      account.actor === null
        ? []
        : await access(
            async (db) =>
              ((await db.get("pending", account.actor as string)) as
                | PendingResult[]
                | undefined) ?? [],
          ),
    write: async (entries) => {
      if (account.actor !== null) {
        await access(async (db) => {
          await db.put("pending", entries, account.actor as string);
        });
      }
    },
  });
});
