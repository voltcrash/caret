/** Load a flat API router on its first request; concurrent requests share it. */
export type RequestLease = { signal: AbortSignal; assertCurrent: () => void };

export function lazyClient<T extends object>(
  load: () => Promise<T>,
  capture?: (method: string) => RequestLease,
): T {
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
          // Capture before loading a contract chunk: cookies can change meanwhile.
          const lease = capture?.(key);
          const client = await getClient();
          lease?.assertCurrent();
          const endpoint = Reflect.get(client, key) as unknown;
          if (typeof endpoint !== "function") {
            throw new Error(`Unknown API endpoint: ${key}`);
          }
          const requestArgs =
            lease === undefined
              ? args
              : [
                  {
                    ...(args[0] as object | undefined),
                    fetchOptions: {
                      ...(args[0] as { fetchOptions?: object } | undefined)
                        ?.fetchOptions,
                      signal: lease.signal,
                    },
                  },
                ];
          try {
            const result: unknown = await Reflect.apply(
              endpoint,
              client,
              requestArgs,
            );
            lease?.assertCurrent();
            return result;
          } catch (error) {
            lease?.assertCurrent();
            throw error;
          }
        };
        methods.set(key, method);
      }
      return method;
    },
  });
}
