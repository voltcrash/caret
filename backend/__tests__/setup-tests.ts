import { beforeAll, afterAll, afterEach, vi } from "vite-plus/test";
import { BASE_CONFIGURATION } from "../src/constants/base-configuration";
import "./setup-common-mocks";
import { createTestRuntime } from "./d1/helpers";
import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { createETagGenerator } from "../src/utils/etag";
import { resolve } from "node:path";
import { withRuntime, type WorkerEnv } from "../src/runtime/env";
import { dispatchApi } from "./__testData__/http-worker";

process.env["MODE"] = "dev";
process.env["TZ"] = "UTC";
vi.mock("../src/init/configuration", async (importOriginal) => {
  const orig = (await importOriginal()) as any;

  return {
    __testing: orig.__testing,
    getLiveConfiguration: () => BASE_CONFIGURATION,
    getCachedConfiguration: () => BASE_CONFIGURATION,
    patchConfiguration: vi.fn(),
  };
});

const assets = new Hono().use(
  serveStatic({
    root: "/",
    rewriteRequestPath: (path) =>
      path.startsWith("/configure/")
        ? resolve(__dirname, "../private", path.slice("/configure/".length))
        : path,
  }),
);
export function wrapUnitApp<T extends Hono<any>>(app: T): T {
  const fetch = app.fetch;
  app.fetch = async (...args) =>
    await unitRuntime(async () => await fetch(...args));
  return app;
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
    ASSETS: {
      fetch: async (input: string, init?: RequestInit) => {
        const response = await assets.fetch(
          new Request(input, { ...init, method: "GET" }),
        );
        const headers = new Headers(response.headers);
        const full = await assets.fetch(new Request(input, { method: "GET" }));
        headers.set(
          "etag",
          createETagGenerator({ weak: true })(
            Buffer.from(await full.arrayBuffer()),
            undefined,
          ),
        );
        headers.set("cache-control", "public, max-age=0");
        return new Response(init?.method === "HEAD" ? null : response.body, {
          status: response.status,
          headers,
        });
      },
    },
  };
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) (env as Record<string, unknown>)[key] = value;
  }
  return withRuntime(env as unknown as WorkerEnv, fn);
}
vi.mock("@hono/node-server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@hono/node-server")>();
  return {
    ...original,
    getRequestListener: (
      handler: Parameters<typeof original.getRequestListener>[0],
    ) =>
      original.getRequestListener((...args) =>
        unitRuntime(() => handler(...args)),
      ),
  };
});
// Controller unit tests mock DAL operations. Real transactions are covered by d1/*.spec.ts.
vi.mock("../src/db/mutation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/db/mutation")>()),
  atomicUser: async (_uid: string, action: () => Promise<unknown>) =>
    await action(),
}));
beforeAll(async () => {
  testRuntime = await createTestRuntime();
});
afterEach(async () => {
  vi.useRealTimers();
  await testRuntime.env.DB.prepare("DELETE FROM rate_counters").run();
});

afterAll(async () => {
  vi.useRealTimers();
  await testRuntime.dispose();
  vi.resetAllMocks();
});
