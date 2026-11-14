type ResultHasher = typeof import("./legacy-hash").legacyHash;

/** Starts loading the result hasher so saving a result does not wait on it. */
export async function preloadResultHasher(): Promise<ResultHasher> {
  return (await import("./legacy-hash")).legacyHash;
}

export async function hashResult(result: object): Promise<string> {
  return (await preloadResultHasher())(result);
}
