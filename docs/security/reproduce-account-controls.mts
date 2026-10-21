import assert from "node:assert/strict";
import {
  createTestRuntime,
  seedUser,
} from "../../backend/__tests__/d1/helpers";
import { withRuntime } from "../../backend/src/runtime/env";
import { getAuth } from "../../backend/src/init/auth";
import { patchConfiguration } from "../../backend/src/init/configuration";
import { dispatchApi } from "../../backend/__tests__/__testData__/http-worker";

// Local migrated Miniflare D1 only. No production credentials or outbound calls.
// These assertions document vulnerable behavior; invert them when fixing it.

const test = await createTestRuntime();
Object.assign(test.env, {
  MODE: "production",
  FRONTEND_URL: "https://oxytype.test",
  BETTER_AUTH_URL: "https://oxytype.test/api/auth",
  BETTER_AUTH_SECRET: "local-audit-fixture-secret-at-least-32-characters",
});
const execution = {
  waitUntil: (task: Promise<unknown>) => void task.catch(() => {}),
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
    assert(session);
    await patchConfiguration({
      apeKeys: { acceptKeys: true, endpointsEnabled: true, maxKeysPerUser: 5 },
    });
    await test.env.DB.prepare(
      "UPDATE auth_sessions SET created_at=? WHERE user_id=?",
    )
      .bind(Date.now() - 300_000, user.id)
      .run();
    const request = async (
      path: string,
      authorization: string,
      method = "GET",
      body?: unknown,
    ) =>
      await withRuntime(
        test.env,
        async () =>
          await dispatchApi(
            new Request(`https://oxytype.test${path}`, {
              method,
              headers: {
                authorization,
                origin: "https://oxytype.test",
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
    assert.equal(minted.status, 200);
    const payload = (await minted.json()) as { data: { apeKey: string } };
    const key = payload.data.apeKey;
    const freshRequired = await request(
      "/api/users/name",
      `Bearer ${session.token}`,
      "PATCH",
      { name: "AuditRenamed" },
    );
    assert.equal(freshRequired.status, 401);
    console.log(
      JSON.stringify({
        check: "stale-session-credential-creation",
        sessionAgeMinutes: 5,
        mintKeyStatus: minted.status,
        renameStatus: freshRequired.status,
      }),
    );

    await test.env.DB.prepare("UPDATE auth_users SET disabled=1 WHERE id=?")
      .bind(user.id)
      .run();
    const disabledSession = await request(
      "/api/users/stats",
      `Bearer ${session.token}`,
    );
    const disabledKey = await request("/api/users/stats", `ApeKey ${key}`);
    const disabledAuthMutation = await request(
      "/api/auth/update-user",
      `Bearer ${session.token}`,
      "POST",
      { name: "Disabled account mutation" },
    );
    assert.equal(disabledSession.status, 403);
    assert.equal(disabledKey.status, 200);
    assert.equal(disabledAuthMutation.status, 200);
    console.log(
      JSON.stringify({
        check: "disabled-account",
        sessionStatus: disabledSession.status,
        apiKeyStatus: disabledKey.status,
        authUpdateUserStatus: disabledAuthMutation.status,
      }),
    );

    const token = await test.env.DB.prepare(
      "SELECT access_token FROM auth_accounts WHERE user_id=?",
    )
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
