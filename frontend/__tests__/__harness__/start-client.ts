/** Start compiles this wrapper away in browser builds. */
export function createClientOnlyFn<T>(callback: T): T {
  return callback;
}
