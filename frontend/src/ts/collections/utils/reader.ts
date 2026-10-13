import type { Collection } from "@tanstack/solid-db";
import { createSignal } from "solid-js";
import type { ModuleHotContext } from "../../hooks/createEvent";

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
 * The permanent subscription keeps the collection synced and its data retained.
 */
export function createCollectionReader<
  T extends object,
  TKey extends string | number,
>(
  hot: ModuleHotContext | undefined,
  collection: ReadableCollection<T, TKey>,
): CollectionReader<T, TKey> {
  const [version, setVersion] = createSignal(undefined, { equals: false });
  const subscription = collection.subscribeChanges(() => setVersion());
  hot?.dispose(() => subscription.unsubscribe());

  return {
    values: () => {
      version();
      return [...collection.values()];
    },
    get: (key) => {
      version();
      return collection.get(key);
    },
  };
}
