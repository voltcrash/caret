/** Load a flat API router on its first request; concurrent requests share it. */
export function lazyClient<T extends object>(load: () => Promise<T>): T {
  let pending: Promise<T> | undefined;
  const methods = new Map<
    PropertyKey,
    (...args: unknown[]) => Promise<unknown>
  >();
  const getClient = async (): Promise<T> => {
    pending ??= load().catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };

  // The loader supplies the method signatures; the proxy preserves them.
  return new Proxy({} as T, {
    get(_target, key) {
      if (typeof key !== "string" || key === "then") return undefined;
      let method = methods.get(key);
      if (method === undefined) {
        method = async (...args) => {
          const client = await getClient();
          const endpoint = Reflect.get(client, key) as unknown;
          if (typeof endpoint !== "function") {
            throw new Error(`Unknown API endpoint: ${key}`);
          }
          return Reflect.apply(endpoint, client, args) as unknown;
        };
        methods.set(key, method);
      }
      return method;
    },
  });
}
