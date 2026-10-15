/** Own enumerable keys; distributes over unions like `keyof` per member. */
export function typedKeys<T extends object>(
  obj: T,
): T extends T ? (keyof T)[] : never;
export function typedKeys<T extends object>(obj: T): (keyof T)[] {
  return Object.keys(obj).filter((key) => isKeyOf(obj, key));
}

function isKeyOf<T extends object>(obj: T, key: PropertyKey): key is keyof T {
  return key in obj;
}

export function typedEntries<T extends object>(
  obj: T,
): { [K in keyof T]: [K, T[K]] }[keyof T][] {
  return Object.entries(obj) as { [K in keyof T]: [K, T[K]] }[keyof T][];
}

export function typedValues<T extends object>(obj: T): T[keyof T][] {
  return Object.values(obj) as T[keyof T][];
}

/** Assign a property while retaining the relationship between its key and value. */
export function setProperty<T extends object, K extends keyof T>(
  object: T,
  key: K,
  value: T[K],
): void {
  object[key] = value;
}
