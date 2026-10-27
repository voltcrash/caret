import { beforeAll, afterAll, afterEach, vi } from "vite-plus/test";
import "./setup-unit";
import { createTestRuntime } from "./postgres/helpers";
import { readFile } from "node:fs/promises";
import { createETagGenerator } from "../src/utils/etag";
import { withRuntime, type WorkerEnv } from "../src/runtime/env";
import { dispatchApi } from "./__testData__/http-worker";

/** Static asset binding stand-in: URL paths name files on disk. */
async function fetchAsset(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  let body: Buffer;
  try {
    body = await readFile(decodeURIComponent(new URL(input).pathname));
  } catch {
    return new Response("Not Found", { status: 404 });
  }
  return new Response(init?.method === "HEAD" ? null : new Uint8Array(body), {
    headers: {
      etag: createETagGenerator({ weak: true })(body, undefined),
      "cache-control": "public, max-age=0",
    },
  });
}
/** Start's `/api` handlers in the unit runtime; relative paths use the dev origin. */
export const unitApi = {
  request: async (input: string, init?: RequestInit): Promise<Response> =>
    await unitRuntime(
      async () =>
        await dispatchApi(
          new Request(new URL(input, "http://localhost:5005"), init),
        ),
    ),
};
export type UnitApi = typeof unitApi;
let testRuntime: Awaited<ReturnType<typeof createTestRuntime>>;
export function unitRuntime<T>(fn: () => T): T {
  const env = {
    ...testRuntime.env,
    ASSETS: { fetch: fetchAsset },
  };
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) (env as Record<string, unknown>)[key] = value;
  }
  return withRuntime(env as unknown as WorkerEnv, fn);
}
// Controller unit tests mock DAL operations. Real transactions are covered by postgres/*.spec.ts.
vi.mock("../src/db/mutation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/db/mutation")>()),
  atomicUser: async (_uid: string, action: () => Promise<unknown>) =>
    await action(),
  // No batch: callers fall back to separate reads.
  atomicUserWithReads: async (
    _uid: string,
    action: () => Promise<unknown>,
    readsFor: (result: unknown) => unknown[],
  ) => {
    const result = await action();
    readsFor(result);
    return { result, reads: undefined };
  },
}));
beforeAll(async () => {
  testRuntime = await createTestRuntime();
  // Workers Cache API (bad-authentication points) from the same Miniflare.
  globalThis.caches = testRuntime.caches;
});
afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  vi.useRealTimers();
  await testRuntime.dispose();
  vi.resetAllMocks();
});
