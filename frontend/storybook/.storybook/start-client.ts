/** Storybook has no Start compiler; client-only callbacks execute in its browser. */
export function createClientOnlyFn<T>(callback: T): T {
  return callback;
}
