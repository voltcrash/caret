/**
 * A handle a mounted component publishes to imperative callers. Only the value
 * that was bound can clear it, so a remount never loses a newer handle.
 */
export type Binding<T> = {
  get: () => T | undefined;
  /** Throws `message` when nothing is bound. */
  require: (message: string) => T;
  /** Publishes `value`; the returned release clears it if still current. */
  bind: (value: T) => () => void;
};

export function createBinding<T>(): Binding<T> {
  const slot: { value?: T } = {};
  return {
    get: () => slot.value,
    require: (message) => {
      if (slot.value === undefined) throw new Error(message);
      return slot.value;
    },
    bind: (value) => {
      slot.value = value;
      return () => {
        if (slot.value === value) delete slot.value;
      };
    },
  };
}
