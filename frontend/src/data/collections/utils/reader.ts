import type { Collection } from "@tanstack/solid-db";
import { createSignal } from "solid-js";
import { collectionScope } from "./scope";

type ReadableCollection<T extends object, TKey extends string | number> = Pick<
  Collection<T, TKey>,
  "get" | "values" | "subscribeChanges"
>;

export type CollectionReader<T, TKey> = {
  values: () => T[];
  get: (key: TKey) => T | undefined;
};

/**
 * Synchronous collection reads that track changes inside Solid scopes.
 * Wrap reads in `untrack` where a snapshot is intended.
 * The subscription keeps the collection synced and its data retained until
 * the owning collection scope releases it.
 */
export function createCollectionReader<
  T extends object,
  TKey extends string | number,
>(getCollection: () => ReadableCollection<T, TKey>): CollectionReader<T, TKey> {
  const key = {};
  const read = (): ReadableCollection<T, TKey> => {
    const collection = getCollection();
    const tracked = collectionScope().use(
      key,
      () => {
        const [version, setVersion] = createSignal(undefined, {
          equals: false,
        });
        // Initial state marks existing keys as delivered, so later deletes emit.
        const subscription = collection.subscribeChanges(() => setVersion(), {
          includeInitialState: true,
        });
        return { collection, version, subscription };
      },
      ({ subscription }) => subscription.unsubscribe(),
    );
    tracked.version();
    return tracked.collection;
  };

  return {
    values: () => [...read().values()],
    get: (id) => read().get(id),
  };
}
