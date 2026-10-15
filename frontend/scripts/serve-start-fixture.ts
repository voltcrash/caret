import { createWorkerd, seedSession } from "../__tests__/start/workerd";

async function main(): Promise<void> {
  const mf = await createWorkerd(false, 4185);
  const db = await mf.getD1Database("DB", "a");
  for (const token of [
    "browser-login",
    "browser-expiry",
    "browser-pending",
    "browser-dismissal",
  ]) {
    const session = await seedSession(mf, "a");
    await db
      .prepare("UPDATE auth_sessions SET token=? WHERE token=?")
      .bind(token, session.token)
      .run();
    if (["browser-login", "browser-expiry"].includes(token)) {
      await db
        .prepare(
          "INSERT INTO users(uid,id,name,name_key,email,added_at,data) VALUES(?,?,?,?,?,0,?)",
        )
        .bind(
          session.uid,
          session.uid,
          token,
          token,
          `${token}@example.test`,
          JSON.stringify({
            uid: session.uid,
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
  console.log(`Start fixture ready: ${await mf.ready}`);
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void mf.dispose().finally(() => process.exit(0));
    });
  }
}

void main();
