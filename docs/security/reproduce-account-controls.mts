import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  createTestRuntime,
  seedUser,
} from "../../backend/__tests__/postgres/helpers";
import { withRuntime } from "../../backend/src/runtime/env";
import { getAuth } from "../../backend/src/init/auth";
import { dispatchApi } from "../../backend/__tests__/__testData__/http-worker";

// Local PGlite PostgreSQL only. No production credentials or outbound calls.
// Checks retired key routes and guards against the disabled-auth regression.

const test = await createTestRuntime();
Object.assign(test.env, {
  MODE: "production",
  FRONTEND_URL: "https://caret.test",
  BETTER_AUTH_URL: "https://caret.test/api/auth",
  BETTER_AUTH_SECRET: "local-audit-fixture-secret-at-least-32-characters",
});
const execution = {
  waitUntil: (task: Promise<unknown>): void => {
    void task.catch((error: unknown) =>
      console.error("Local audit background task failed", error),
    );
  },
};
try {
  await withRuntime(test.env, async () => {
    const auth = await getAuth().$context;
    const user = await auth.internalAdapter.createUser(
      { name: "Audit", email: "audit@example.test", emailVerified: true },
      { method: "oauth", oauth: { providerId: "github" } },
    );
    await seedUser(test.env, user.id, "AuditFixture");
    await auth.internalAdapter.createAccount({
      userId: user.id,
      providerId: "github",
      accountId: "audit-provider-id",
      accessToken: "local-audit-oauth-token",
    });
    const session = await auth.internalAdapter.createSession(user.id, false);
    assert.notEqual(session, null);
    await test.db
      .prepare("UPDATE auth_sessions SET created_at=? WHERE user_id=?")
      .bind(new Date(Date.now() - 300_000), user.id)
      .run();
    const request = async (
      path: string,
      credential: string | { cookie: string },
      method = "GET",
      body?: unknown,
    ): Promise<Response> =>
      await withRuntime(
        test.env,
        async () =>
          await dispatchApi(
            new Request(`https://caret.test${path}`, {
              method,
              headers: {
                ...(typeof credential === "string"
                  ? { authorization: credential }
                  : credential),
                origin: "https://caret.test",
                "content-type": "application/json",
              },
              ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            }),
          ),
        execution,
      );
    const minted = await request(
      "/api/ape-keys",
      `Bearer ${session.token}`,
      "POST",
      { name: "audit-key", enabled: true },
    );
    assert.equal(minted.status, 404);
    const freshRequired = await request(
      "/api/users/name",
      `Bearer ${session.token}`,
      "PATCH",
      { name: "AuditRenamed" },
    );
    assert.equal(freshRequired.status, 401);
    console.log(
      JSON.stringify({
        check: "retired-key-creation",
        sessionAgeMinutes: 5,
        mintKeyStatus: minted.status,
        renameStatus: freshRequired.status,
      }),
    );

    await test.db
      .prepare("UPDATE auth_users SET disabled=true WHERE id=?")
      .bind(user.id)
      .run();
    const disabledSession = await request(
      "/api/users/stats",
      `Bearer ${session.token}`,
    );
    const disabledKey = await request("/api/users/stats", "ApeKey retired-key");
    const disabledAuthMutation = await request(
      "/api/auth/update-user",
      `Bearer ${session.token}`,
      "POST",
      { name: "Disabled account mutation" },
    );
    assert.equal(disabledSession.status, 403);
    assert.equal(disabledKey.status, 401);
    assert.equal(disabledAuthMutation.status, 403);
    // The bearer rejection revoked every old session. Use a new session for
    // independent cookie coverage, then simulate a direct database disable.
    await test.db
      .prepare("UPDATE auth_users SET disabled=false WHERE id=?")
      .bind(user.id)
      .run();
    const cookieSession = await auth.internalAdapter.createSession(
      user.id,
      false,
    );
    assert.notEqual(cookieSession, null);
    await test.db
      .prepare("UPDATE auth_users SET disabled=true WHERE id=?")
      .bind(user.id)
      .run();
    const signature = createHmac("sha256", test.env.BETTER_AUTH_SECRET ?? "")
      .update(cookieSession.token)
      .digest("base64");
    const cookie = `__Secure-caret.session_token=${encodeURIComponent(`${cookieSession.token}.${signature}`)}`;
    const disabledCookieSession = await request("/api/users/stats", { cookie });
    const disabledCookieMutation = await request(
      "/api/auth/update-user",
      { cookie },
      "POST",
      { name: "Disabled cookie mutation", disabled: false },
    );
    assert.equal(disabledCookieSession.status, 403);
    assert.equal(disabledCookieMutation.status, 403);
    const stored = await test.db
      .prepare("SELECT name,disabled FROM auth_users WHERE id=?")
      .bind(user.id)
      .first<{ name: string; disabled: boolean }>();
    assert.equal(stored?.name, "Audit");
    assert.equal(stored.disabled, true);
    const sessionsRemaining = await test.db
      .prepare("SELECT count(*) AS count FROM auth_sessions WHERE user_id=?")
      .bind(user.id)
      .first<number>("count");
    assert.equal(sessionsRemaining, 0);
    console.log(
      JSON.stringify({
        check: "disabled-account",
        sessionStatus: disabledSession.status,
        apiKeyStatus: disabledKey.status,
        authUpdateUserStatus: disabledAuthMutation.status,
        cookieSessionStatus: disabledCookieSession.status,
        cookieAuthUpdateUserStatus: disabledCookieMutation.status,
        disabledFlagPreserved: stored.disabled === true,
        nativeMutationsBlocked: true,
        namePreserved: stored.name === "Audit",
        sessionsRemaining,
      }),
    );

    const token = await test.db
      .prepare("SELECT access_token FROM auth_accounts WHERE user_id=?")
      .bind(user.id)
      .first<string>("access_token");
    assert.equal(token, "local-audit-oauth-token");
    console.log(
      JSON.stringify({ check: "oauth-token-storage", plaintext: true }),
    );
  });
} finally {
  await test.dispose();
}
