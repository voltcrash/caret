import { createHmac } from "node:crypto";
import { memoryAdapter } from "better-auth/adapters/memory";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { unitApi, unitRuntime } from "../setup-tests";
import { createAuth } from "../../src/init/auth";
import * as AuthInit from "../../src/init/auth";

const origin = "https://oxytype.test";
const secret = "disabled-account-test-secret-at-least-32-characters";
let auth: ReturnType<typeof createAuth>;

beforeEach(() => {
  vi.stubEnv("MODE", "production");
  vi.stubEnv("FRONTEND_URL", origin);
  vi.stubEnv("BETTER_AUTH_URL", `${origin}/api/auth`);
  vi.stubEnv("BETTER_AUTH_SECRET", secret);
  auth = createAuth(
    memoryAdapter({
      authUsers: [],
      authAccounts: [],
      authSessions: [],
      authVerifications: [],
    }),
  );
  vi.spyOn(AuthInit, "getAuth").mockReturnValue(auth);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function fixture(): Promise<{
  userId: string;
  token: string;
  otherToken: string;
  unrelatedToken: string;
  cookie: string;
}> {
  return await unitRuntime(async () => {
    const context = await auth.$context;
    const createUser = async (name: string): Promise<{ id: string }> =>
      await context.internalAdapter.createUser(
        { name, email: `${name}@example.test`, emailVerified: true },
        { method: "oauth", oauth: { providerId: "github" } },
      );
    const user = await createUser("DisabledFixture");
    const unrelated = await createUser("UnrelatedFixture");
    const session = await context.internalAdapter.createSession(user.id, false);
    const other = await context.internalAdapter.createSession(user.id, false);
    const unrelatedSession = await context.internalAdapter.createSession(
      unrelated.id,
      false,
    );
    if (session === null || other === null || unrelatedSession === null) {
      throw new Error("Missing fixture sessions");
    }
    const signature = createHmac("sha256", secret)
      .update(session.token)
      .digest("base64");
    return {
      userId: user.id,
      token: session.token,
      otherToken: other.token,
      unrelatedToken: unrelatedSession.token,
      cookie: `__Secure-oxytype.session_token=${encodeURIComponent(`${session.token}.${signature}`)}`,
    };
  });
}

async function setDisabled(userId: string, disabled: boolean): Promise<void> {
  // Bypass hooks to model existing disabled accounts and direct database edits.
  await (
    await auth.$context
  ).adapter.update({
    model: "user",
    where: [{ field: "id", value: userId }],
    update: { disabled },
  });
}

function headers(
  identity: Awaited<ReturnType<typeof fixture>>,
  credential: "cookie" | "bearer",
): Record<string, string> {
  return credential === "cookie"
    ? { cookie: identity.cookie, origin }
    : { authorization: `Bearer ${identity.token}` };
}

it.each([
  ["cookie", "/update-user"],
  ["bearer", "/update-user"],
  ["cookie", "/list-sessions"],
  ["bearer", "/list-sessions"],
  ["cookie", "/get-session"],
  ["bearer", "/get-session"],
] as const)(
  "rejects disabled %s sessions at native %s",
  async (credential, path) => {
    const identity = await fixture();
    await setDisabled(identity.userId, true);
    const response = await unitApi.request(`${origin}/api/auth${path}`, {
      method: path === "/update-user" ? "POST" : "GET",
      headers: {
        ...headers(identity, credential),
        "content-type": "application/json",
      },
      ...(path === "/update-user"
        ? {
            body: JSON.stringify({
              name: "Forbidden mutation",
              disabled: false,
            }),
          }
        : {}),
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      message: "Account disabled",
    });
    const context = await auth.$context;
    expect(
      await context.internalAdapter.findUserById(identity.userId),
    ).toMatchObject({
      name: "DisabledFixture",
      disabled: true,
    });
    for (const token of [identity.token, identity.otherToken]) {
      expect(await context.internalAdapter.findSession(token)).toBeNull();
    }
    expect(
      await context.internalAdapter.findSession(identity.unrelatedToken),
    ).not.toBeNull();
  },
);

it("revokes every session on disable and requires a new session after re-enabling", async () => {
  const identity = await fixture();
  const context = await auth.$context;
  await unitRuntime(
    async () =>
      await context.internalAdapter.updateUser(identity.userId, {
        disabled: true,
      }),
  );
  for (const token of [identity.token, identity.otherToken]) {
    expect(await context.internalAdapter.findSession(token)).toBeNull();
  }
  expect(
    await context.internalAdapter.findSession(identity.unrelatedToken),
  ).not.toBeNull();
  await unitRuntime(
    async () =>
      await context.internalAdapter.updateUser(identity.userId, {
        disabled: false,
      }),
  );
  expect(await context.internalAdapter.findSession(identity.token)).toBeNull();
  const revoked = await unitApi.request(`${origin}/api/auth/list-sessions`, {
    headers: headers(identity, "bearer"),
  });
  expect(revoked.status).toBe(401);
  const replacement = await unitRuntime(
    async () =>
      await context.internalAdapter.createSession(identity.userId, false),
  );
  if (replacement === null) throw new Error("Missing replacement session");
  const enabled = await unitApi.request(`${origin}/api/auth/update-user`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${replacement.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: "Enabled account" }),
  });
  expect(enabled.status).toBe(200);
});

it("preserves sessions during ordinary enabled-account updates", async () => {
  const identity = await fixture();
  const response = await unitApi.request(`${origin}/api/auth/update-user`, {
    method: "POST",
    headers: {
      ...headers(identity, "cookie"),
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: "Enabled update" }),
  });
  expect(response.status).toBe(200);
  const context = await auth.$context;
  for (const token of [identity.token, identity.otherToken]) {
    expect(await context.internalAdapter.findSession(token)).not.toBeNull();
  }
});

it.each(["cookie", "bearer"] as const)(
  "allows disabled %s sessions to sign out and revokes their other sessions",
  async (credential) => {
    const identity = await fixture();
    await setDisabled(identity.userId, true);
    const response = await unitApi.request(`${origin}/api/auth/sign-out`, {
      method: "POST",
      headers: {
        ...headers(identity, credential),
        "content-type": "application/json",
      },
      body: "{}",
    });
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().join(";")).toContain("Max-Age=0");
    const context = await auth.$context;
    for (const token of [identity.token, identity.otherToken]) {
      expect(await context.internalAdapter.findSession(token)).toBeNull();
    }
  },
);

it("rejects foreign-origin writes before revoking disabled sessions", async () => {
  const identity = await fixture();
  await setDisabled(identity.userId, true);
  const response = await unitApi.request(`${origin}/api/auth/update-user`, {
    method: "POST",
    headers: {
      cookie: identity.cookie,
      origin: "https://attacker.test",
      "content-type": "application/json",
    },
    body: JSON.stringify({ name: "Forbidden mutation" }),
  });
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ message: "Untrusted origin" });
  expect(
    await (await auth.$context).internalAdapter.findSession(identity.token),
  ).not.toBeNull();
});
