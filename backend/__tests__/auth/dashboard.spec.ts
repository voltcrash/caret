import { createHash, generateKeyPairSync, sign } from "node:crypto";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { memoryAdapter } from "better-auth/adapters/memory";
import { unitApi, unitRuntime, type UnitApi } from "../setup-tests";
import { createAuth } from "../../src/init/auth";
import * as AuthInit from "../../src/init/auth";
import { runtime, withRuntime } from "../../src/runtime/env";

const apiKey = "ba_dashboard_test_fixture";
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = {
  ...publicKey.export({ format: "jwk" }),
  alg: "RS256",
  kid: "test",
};

function token(key = apiKey, claims: Record<string, string> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", kid: "test" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      apiKeyHash: createHash("sha256").update(key).digest("hex"),
      iat: now,
      exp: now + 60,
      ...claims,
    }),
  ).toString("base64url");
  const data = `${header}.${payload}`;
  return `${data}.${sign("sha256", Buffer.from(data), privateKey).toString("base64url")}`;
}

describe("Better Auth dashboard", () => {
  let auth: ReturnType<typeof createAuth>;
  let app: UnitApi;
  let store: Record<string, unknown[]>;

  beforeEach(() => {
    vi.stubEnv("BETTER_AUTH_API_KEY", apiKey);
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url === "https://dash.better-auth.com/api/auth/jwks") {
          return Response.json({ keys: [jwk] });
        }
        return Response.json({ success: true });
      }),
    );
    store = {
      authUsers: [],
      authAccounts: [],
      authSessions: [],
      authVerifications: [],
      authRateLimits: [],
    };
    auth = createAuth(memoryAdapter(store));
    vi.spyOn(AuthInit, "getAuth").mockImplementation(() => auth);
    app = unitApi;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("leaves dashboard endpoints disabled without a project API key", async () => {
    vi.stubEnv("BETTER_AUTH_API_KEY", "  ");
    auth = createAuth(memoryAdapter(store));
    expect((await app.request("/auth/dash/config")).status).toBe(404);
  });

  it.each(["/dash/config", "/dash/validate", "/dash/list-users"])(
    "rejects unsigned access to %s",
    async (path) => {
      expect((await app.request(`/auth${path}`)).status).toBe(401);
    },
  );

  it("uses invocation bindings rather than a process-wide dashboard key", async () => {
    const workerKey = "ba_worker_scoped_test_fixture";
    auth = unitRuntime(() =>
      withRuntime({ ...runtime().env, BETTER_AUTH_API_KEY: workerKey }, () =>
        createAuth(memoryAdapter(store)),
      ),
    );
    const request = async (key: string): Promise<Response> =>
      await app.request("/auth/dash/validate", {
        headers: { authorization: `Bearer ${token(key)}` },
      });
    expect((await request(apiKey)).status).toBe(401);
    expect((await request(workerKey)).status).toBe(200);
  });

  it("supports signed dashboard mutations without weakening cookie origin checks", async () => {
    await unitRuntime(async () => {
      const context = await auth.$context;
      const user = await context.internalAdapter.createUser(
        {
          name: "Dashboard",
          email: "dashboard@example.com",
          emailVerified: true,
        },
        { method: "oauth", oauth: { providerId: "github" } },
      );
      const session = await context.internalAdapter.createSession(
        user.id,
        false,
      );
      if (session === null) throw new Error("Missing test session");
      const authorization = `Bearer ${token(apiKey, { sessionId: session.id, userId: user.id })}`;
      const path = "/auth/dash/sessions/revoke";
      const browser = await app.request(path, {
        method: "POST",
        headers: { authorization, cookie: "oxytype.session_token=fixture" },
      });
      expect(browser.status).toBe(403);
      const invalid = await app.request(path, {
        method: "POST",
        headers: { authorization: `Bearer ${token("ba_wrong_key")}` },
      });
      expect(invalid.status).toBe(401);
      expect(
        await context.internalAdapter.findSession(session.token),
      ).not.toBeNull();
      const signed = await app.request(path, {
        method: "POST",
        headers: { authorization },
      });
      expect(signed.status).toBe(200);
      expect(
        await context.internalAdapter.findSession(session.token),
      ).toBeNull();
      expect(
        (
          await app.request("/auth/sign-out", {
            method: "POST",
            headers: { authorization },
          })
        ).status,
      ).toBe(403);
    });
  });

  it("keeps dashboard background work attached to the Worker invocation", async () => {
    const waitUntil = vi.fn();
    await unitRuntime(
      async () =>
        await withRuntime(
          runtime().env,
          async () => {
            const context = await createAuth(memoryAdapter(store)).$context;
            context.runInBackground(Promise.resolve());
            expect(waitUntil).toHaveBeenCalledOnce();
            await waitUntil.mock.calls[0]?.[0];
          },
          { waitUntil },
        ),
    );
  });

  it("permits signed administration of disabled users and rejects session tokens", async () => {
    await unitRuntime(async () => {
      const context = await auth.$context;
      const user = await context.internalAdapter.createUser(
        {
          name: "Disabled",
          email: "disabled@example.test",
          emailVerified: true,
        },
        { method: "oauth", oauth: { providerId: "github" } },
      );
      const session = await context.internalAdapter.createSession(
        user.id,
        false,
      );
      if (session === null) throw new Error("Missing fixture session");
      await context.adapter.update({
        model: "user",
        where: [{ field: "id", value: user.id }],
        update: { disabled: true },
      });
      const request = async (authorization: string): Promise<Response> =>
        await app.request("/auth/dash/update-user", {
          method: "POST",
          headers: { authorization, "content-type": "application/json" },
          body: JSON.stringify({ name: "Administrator update" }),
        });
      expect((await request(`Bearer ${session.token}`)).status).toBe(401);
      expect(
        (await request(`Bearer ${token("ba_wrong_key", { userId: user.id })}`))
          .status,
      ).toBe(401);
      expect(await context.internalAdapter.findUserById(user.id)).toMatchObject(
        {
          name: "Disabled",
          disabled: true,
        },
      );
      expect(
        (await request(`Bearer ${token(apiKey, { userId: user.id })}`)).status,
      ).toBe(200);
      expect(await context.internalAdapter.findUserById(user.id)).toMatchObject(
        {
          name: "Administrator update",
          disabled: true,
        },
      );
      expect(
        await context.internalAdapter.findSession(session.token),
      ).toBeNull();
    });
  });
});
