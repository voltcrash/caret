import { unitApi, type UnitApi } from "../setup-tests";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { memoryAdapter } from "better-auth/adapters/memory";
import { createAuth, SESSION_COOKIE_CACHE_SECONDS } from "../../src/init/auth";
import * as AuthInit from "../../src/init/auth";
import * as AuthUtils from "../../src/utils/auth";
import { signInWithOAuth } from "../__testData__/oauth";

let auth: ReturnType<typeof createAuth>;
let app: UnitApi;
let store: Record<string, unknown[]>;

beforeEach(() => {
  for (const provider of ["GOOGLE", "GITHUB"]) {
    vi.stubEnv(`${provider}_CLIENT_ID`, "test-client");
    vi.stubEnv(`${provider}_CLIENT_SECRET`, "test-secret");
  }
  store = {
    authUsers: [],
    authAccounts: [],
    authSessions: [],
    authVerifications: [],
  };
  auth = createAuth(memoryAdapter(store));
  vi.spyOn(AuthInit, "getAuth").mockReturnValue(auth);
  app = unitApi;
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function request(
  path: string,
  body?: Record<string, unknown>,
  cookie?: string,
): Promise<Response> {
  return app.request(`http://localhost:5005/auth${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      origin: "http://localhost:3000",
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie !== undefined ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("Better Auth social-only HTTP flow", () => {
  it("rejects OAuth callbacks when the browser loses its state cookie", async () => {
    const callbackURL =
      "http://localhost:3000/oauth-callback.html?requestId=nonce";
    const start = await request("/sign-in/social", {
      provider: "github",
      callbackURL,
      errorCallbackURL: callbackURL,
      disableRedirect: true,
    });
    const data = (await start.json()) as { url: string };
    const state = new URL(data.url).searchParams.get("state");
    expect(state).toBeTruthy();
    const response = await request(
      `/callback/github?code=test-code&state=${state}`,
    );
    expect(response.status).toBe(302);
    const redirect = new URL(response.headers.get("location") ?? "");
    expect(redirect.searchParams.get("error")).toBe("state_mismatch");
    expect(redirect.searchParams.get("requestId")).toBe("nonce");
    expect(store["authUsers"]).toHaveLength(0);
    expect(store["authSessions"]).toHaveLength(0);
  });
  it("sends OAuth callbacks with unknown state to the frontend error page", async () => {
    const response = await request(
      "/callback/github?code=test-code&state=unknown",
    );
    expect(response.status).toBe(302);
    const redirect = new URL(response.headers.get("location") ?? "");
    expect(redirect.origin + redirect.pathname).toBe(
      "http://localhost:3000/oauth-callback.html",
    );
    expect(redirect.searchParams.get("error")).toBeTruthy();
    expect(store["authSessions"]).toHaveLength(0);
  });
  it("completes same-origin HTTPS GitHub OAuth with a secure first-party session", async () => {
    const frontendUrl = "https://staging.example";
    vi.stubEnv("MODE", "production");
    vi.stubEnv("FRONTEND_URL", frontendUrl);
    vi.stubEnv("BETTER_AUTH_URL", `${frontendUrl}/api/auth`);
    vi.stubEnv(
      "BETTER_AUTH_SECRET",
      "test-secret-with-at-least-thirty-two-characters",
    );
    auth = createAuth(memoryAdapter(store));
    vi.spyOn(AuthInit, "getAuth").mockReturnValue(auth);
    const { response, cookie } = await signInWithOAuth(auth, app, {
      provider: "github",
      frontendUrl,
    });
    const sessionCookie = response.headers
      .getSetCookie()
      .find((value) => value.includes("session_token="));
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("Secure");
    expect(sessionCookie).toContain("SameSite=Lax");
    const session = await app.request(
      "https://staging.example/api/auth/get-session",
      { headers: { cookie, origin: frontendUrl } },
    );
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({
      user: { email: "newuser@example.com" },
    });
  });
  it.each(["google", "github"] as const)(
    "creates %s accounts and HttpOnly sessions through OAuth callbacks",
    async (provider) => {
      const { cookie, response } = await signInWithOAuth(auth, app, {
        provider,
      });
      expect(response.headers.getSetCookie().join(";")).toContain("HttpOnly");
      const session = await request("/get-session", undefined, cookie);
      expect(session.status).toBe(200);
      expect(await session.json()).toMatchObject({
        user: {
          email: "newuser@example.com",
          name: "NewUser",
          emailVerified: true,
        },
      });
      expect(session.headers.get("cache-control")).toBe("no-store");
      expect(store["authAccounts"]).toHaveLength(1);
      expect(store["authAccounts"]?.[0]).toMatchObject({
        providerId: provider,
      });
      expect(store["authAccounts"]?.[0]).not.toHaveProperty("password");
      const result = await AuthUtils.verifySession(new Headers({ cookie }));
      expect(result.email).toBe("newuser@example.com");
      expect(result.createdAt).toBeInstanceOf(Date);
    },
  );
  it("always persists OAuth sessions", async () => {
    const { response } = await signInWithOAuth(auth, app);
    const sessionCookie = response.headers
      .getSetCookie()
      .find((value) => value.includes("session_token="));
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("Max-Age");
  });
  it.each([
    "/sign-up/email",
    "/sign-in/email",
    "/request-password-reset",
    "/reset-password",
    "/change-password",
    "/set-password",
    "/verify-password",
    "/send-verification-email",
    "/change-email",
  ])("removes the %s endpoint even for authenticated users", async (path) => {
    const { cookie } = await signInWithOAuth(auth, app);
    const response = await request(
      path,
      {
        email: "newuser@example.com",
        name: "NewUser",
        password: "StrongPassword1!",
        newPassword: "Replacement1!",
        token: "legacy-token",
      },
      cookie,
    );
    expect(response.status).toBe(404);
    expect(store["authAccounts"]).toHaveLength(1);
    expect(store["authVerifications"]).toHaveLength(0);
  });
  it.each([
    "/verify-email?token=legacy-token",
    "/reset-password/legacy-token?callbackURL=http://localhost:3000/oauth-callback",
  ])("removes legacy email action URLs (%s)", async (path) => {
    expect((await request(path)).status).toBe(404);
  });
  it.each(["discord", "facebook", "apple"])(
    "rejects unsupported provider %s",
    async (provider) => {
      expect(
        (
          await request("/sign-in/social", {
            provider,
            callbackURL: "http://localhost:3000/oauth-callback",
          })
        ).status,
      ).toBe(404);
      expect(store["authUsers"]).toHaveLength(0);
    },
  );
  it("invalidates revoked sessions immediately", async () => {
    const { cookie } = await signInWithOAuth(auth, app);
    const session = await AuthUtils.verifySession(new Headers({ cookie }));
    await AuthUtils.revokeTokensByUid(session.uid);
    await expect(
      AuthUtils.verifySession(new Headers({ cookie })),
    ).rejects.toThrow("Session expired or revoked");
  });
  it("serves cookie sessions from the signed cache for at most a minute", async () => {
    const { cookie } = await signInWithOAuth(auth, app);
    expect(cookie).toContain("caret.session_data=");
    const headers = new Headers({ cookie });
    const session = await AuthUtils.verifySession(headers, {});
    await AuthUtils.revokeTokensByUid(session.uid);
    await expect(AuthUtils.verifySession(headers, {})).resolves.toMatchObject({
      uid: session.uid,
    });
    await expect(AuthUtils.verifySession(headers)).rejects.toThrow(
      "Session expired or revoked",
    );
    vi.setSystemTime(Date.now() + (SESSION_COOKIE_CACHE_SECONDS + 1) * 1000);
    await expect(AuthUtils.verifySession(headers, {})).rejects.toThrow(
      "Session expired or revoked",
    );
  });
  it("signs out and rejects a removed cookie session", async () => {
    const { cookie } = await signInWithOAuth(auth, app);
    expect((await request("/sign-out", {}, cookie)).status).toBe(200);
    await expect(
      AuthUtils.verifySession(new Headers({ cookie })),
    ).rejects.toThrow("Session expired or revoked");
  });
  it("rejects foreign origins before starting OAuth", async () => {
    const response = await app.request(
      "http://localhost:5005/auth/sign-in/social",
      {
        method: "POST",
        headers: {
          origin: "https://attacker.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({ provider: "google" }),
      },
    );
    expect(response.status).toBe(403);
    expect(store["authVerifications"]).toHaveLength(0);
  });
  it("deletes linked identities and sessions idempotently", async () => {
    const { cookie } = await signInWithOAuth(auth, app);
    const session = await AuthUtils.verifySession(new Headers({ cookie }));
    await AuthUtils.deleteUser(session.uid);
    await AuthUtils.deleteUser(session.uid);
    expect(store["authUsers"]).toHaveLength(0);
    expect(store["authAccounts"]).toHaveLength(0);
    expect(store["authSessions"]).toHaveLength(0);
  });
  it("keeps public requests anonymous with unrelated cookies", async () => {
    const response = await app.request("http://localhost:5005/configuration", {
      headers: { cookie: "theme=dark" },
    });
    expect(response.status).toBe(200);
  });
  it("resolves auth rate-limit addresses through the API proxy policy", async () => {
    const { cookie } = await signInWithOAuth(auth, app, {
      headers: {
        "x-forwarded-for": "198.51.100.4, 203.0.113.5",
        "x-caret-auth-ip": "192.0.2.1",
      },
    });
    const session = await request("/get-session", undefined, cookie);
    expect(await session.json()).toMatchObject({
      session: { ipAddress: "203.0.113.5" },
    });
  });
  it("blocks cookie-authenticated mutations from foreign origins", async () => {
    const { cookie } = await signInWithOAuth(auth, app);
    const response = await app.request("http://localhost:5005/users/name", {
      method: "PATCH",
      headers: {
        cookie,
        origin: "https://attacker.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "NewName" }),
    });
    expect(response.status).toBe(403);
  });
  it("prevents unlinking the last authentication method", async () => {
    const { cookie } = await signInWithOAuth(auth, app);
    const accounts = await auth.api.listUserAccounts({
      headers: new Headers({ cookie }),
    });
    expect(
      (await request("/unlink-account", { accountId: accounts[0]?.id }, cookie))
        .status,
    ).toBe(400);
    expect(store["authAccounts"]).toHaveLength(1);
  });
  it("does not count legacy credentials when unlinking the last social account", async () => {
    const { cookie } = await signInWithOAuth(auth, app);
    const session = await AuthUtils.verifySession(new Headers({ cookie }));
    const context = await auth.$context;
    await context.internalAdapter.createAccount({
      userId: session.uid,
      providerId: "credential",
      accountId: session.uid,
      password: "legacy-hash",
    });
    const accounts = await auth.api.listUserAccounts({
      headers: new Headers({ cookie }),
    });
    const social = accounts.find((account) => account.providerId === "google");
    expect(
      (await request("/unlink-account", { accountId: social?.id }, cookie))
        .status,
    ).toBe(400);
    expect(store["authAccounts"]).toHaveLength(2);
    expect(
      (
        await request("/sign-in/email", {
          email: session.email,
          password: "password",
        })
      ).status,
    ).toBe(404);
  });
  it("allows unlinking a provider when another supported provider remains", async () => {
    await signInWithOAuth(auth, app, { provider: "google" });
    const { cookie } = await signInWithOAuth(auth, app, { provider: "github" });
    const accounts = await auth.api.listUserAccounts({
      headers: new Headers({ cookie }),
    });
    expect(accounts).toHaveLength(2);
    const google = accounts.find((account) => account.providerId === "google");
    expect(
      (await request("/unlink-account", { accountId: google?.id }, cookie))
        .status,
    ).toBe(200);
    expect(store["authAccounts"]).toHaveLength(1);
    expect(store["authAccounts"]?.[0]).toMatchObject({ providerId: "github" });
  });
  it.each([
    ["PATCH", "/users/email"],
    ["PATCH", "/users/password"],
    ["POST", "/users/verificationEmail"],
    ["POST", "/users/forgotPasswordEmail"],
    ["POST", "/admin/sendForgotPasswordEmail"],
  ])("removes the application %s %s route", async (method, path) => {
    const { cookie } = await signInWithOAuth(auth, app);
    const response = await app.request(`http://localhost:5005${path}`, {
      method,
      headers: { cookie, origin: "http://localhost:3000" },
    });
    expect(response.status).toBe(404);
  });
  it("requires production secrets and a public auth URL", () => {
    vi.stubEnv("MODE", "prod");
    vi.stubEnv("FRONTEND_URL", "http://localhost:3000");
    vi.stubEnv("BETTER_AUTH_SECRET", undefined);
    vi.stubEnv("BETTER_AUTH_URL", undefined);
    expect(() => createAuth(memoryAdapter(store))).toThrow(
      "BETTER_AUTH_SECRET",
    );
    vi.stubEnv(
      "BETTER_AUTH_SECRET",
      "test-secret-with-at-least-thirty-two-characters",
    );
    expect(() => createAuth(memoryAdapter(store))).toThrow("BETTER_AUTH_URL");
  });
});
