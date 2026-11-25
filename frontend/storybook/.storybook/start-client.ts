/** Storybook has no Start compiler; client-only callbacks execute in its browser. */
export function createClientOnlyFn<T>(callback: T): T {
  return callback;
}

export function createIsomorphicFn(): {
  server: <T>(callback: T) => { client: <U>(cb: U) => U };
  client: <U>(cb: U) => U;
} {
  return {
    server: () => ({
      client: (cb) => cb,
    }),
    client: (cb) => cb,
  };
}
