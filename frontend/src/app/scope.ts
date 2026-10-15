type Entry = { value: unknown; dispose: (value: unknown) => void };

/** Lazily created values with an explicit owner-controlled lifetime. */
export type OwnedScope = {
  use: <T>(key: object, create: () => T, dispose: (value: T) => void) => T;
  release: (key: object) => void;
  dispose: () => void;
};

export function createOwnedScope(): OwnedScope {
  const entries = new Map<object, Entry>();
  let disposed = false;
  return {
    use: (key, create, dispose) => {
      if (disposed) throw new Error("Owned scope already disposed");
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
      disposed = true;
      // Dependents (readers, derived subscriptions) were created later.
      for (const [key, entry] of [...entries].reverse()) {
        entries.delete(key);
        entry.dispose(entry.value);
      }
    },
  };
}
