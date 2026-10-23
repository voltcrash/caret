type ObjectHash = typeof import("object-hash");

let hasher: Promise<ObjectHash> | undefined;

/** Starts loading the result hasher so saving a result doesn't wait on it. */
export async function preloadResultHasher(): Promise<ObjectHash> {
  hasher ??= import("object-hash")
    .then((module) => module.default)
    .catch((error: unknown) => {
      hasher = undefined;
      throw error;
    });
  return await hasher;
}

export async function hashResult(result: object): Promise<string> {
  const objectHash = await preloadResultHasher();
  return objectHash(result);
}
