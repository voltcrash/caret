import type { ModuleHotContext } from "../../hooks/createEvent";

type Entry = { value: unknown; dispose: (value: unknown) => void };

/** Lazily created values with an explicit owner-controlled lifetime. */
export type CollectionScope = {
  use: <T>(key: object, create: () => T, dispose: (value: T) => void) => T;
  release: (key: object) => void;
  dispose: () => void;
};

export function createCollectionScope(): CollectionScope {
  const entries = new Map<object, Entry>();
  return {
    use: (key, create, dispose) => {
      const existing = entries.get(key);
      if (existing !== undefined) return existing.value as never;
      const value = create();
      entries.set(key, {
        value,
        dispose: dispose as (value: unknown) => void,
      });
      return value;
    },
    release: (key) => {
      const entry = entries.get(key);
      if (entry === undefined) return;
      entries.delete(key);
      entry.dispose(entry.value);
    },
    dispose: () => {
      // Dependents (readers, derived subscriptions) were created later.
      for (const [key, entry] of [...entries].reverse()) {
        entries.delete(key);
        entry.dispose(entry.value);
      }
    },
  };
}

const moduleScope = createCollectionScope();

export function collectionScope(): CollectionScope {
  return moduleScope;
}

type Disposable = { cleanup: () => Promise<void> };

/** Constructs on first use instead of module evaluation. */
export function defineCollection<T extends Disposable>(
  hot: ModuleHotContext | undefined,
  create: () => T,
): () => T {
  const key = {};
  hot?.dispose(() => collectionScope().release(key));
  return () =>
    collectionScope().use(key, create, (collection) => {
      void collection.cleanup();
    });
}
