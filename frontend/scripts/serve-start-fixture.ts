import {
  createWorkerd,
  enableConfiguration,
  seedLeaderboard,
  seedProfile,
  seedSession,
} from "../__tests__/start/workerd";

async function main(): Promise<void> {
  const mf = await createWorkerd(false, 4185);
  const db = await mf.getD1Database("DB", "a");
  for (const token of [
    "browser-login",
    "browser-expiry",
    "browser-pending",
    "browser-dismissal",
    "browser-private",
    "browser-typing",
  ]) {
    const session = await seedSession(mf, "a");
    await db
      .prepare("UPDATE auth_sessions SET token=? WHERE token=?")
      .bind(token, session.token)
      .run();
    let uid = session.uid;
    // The rollback typing suite's REST fixtures describe this account.
    if (token === "browser-typing") {
      uid = "e2e-user";
      await db.batch([
        db
          .prepare(
            "INSERT INTO auth_users(id,name,email,email_verified,disabled,created_at,updated_at) SELECT ?,'e2e','e2e@example.test',email_verified,disabled,created_at,updated_at FROM auth_users WHERE id=?",
          )
          .bind(uid, session.uid),
        db
          .prepare("UPDATE auth_sessions SET user_id=? WHERE token=?")
          .bind(uid, token),
      ]);
    }
    if (
      [
        "browser-login",
        "browser-expiry",
        "browser-private",
        "browser-typing",
      ].includes(token)
    ) {
      await db
        .prepare(
          "INSERT INTO users(uid,id,name,name_key,email,added_at,data) VALUES(?,?,?,?,?,0,?)",
        )
        .bind(
          uid,
          uid,
          token,
          token,
          `${token}@example.test`,
          JSON.stringify({
            uid,
            name: token,
            email: `${token}@example.test`,
            personalBests: {},
            startedTests: 0,
            completedTests: 0,
            timeTyping: 0,
          }),
        )
        .run();
    }
  }
  // Public pages the browser suite exercises.
  await enableConfiguration(mf, "a", "$.users.profiles", { enabled: true });
  await seedProfile(mf, "a", "fixture-profile");
  await seedLeaderboard(mf, "a", 60);
  console.log(`Start fixture ready: ${await mf.ready}`);
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void mf.dispose().finally(() => process.exit(0));
    });
  }
}

void main();
