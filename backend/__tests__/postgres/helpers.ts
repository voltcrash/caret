import { Miniflare } from "miniflare";
import { TestDatabase } from "./database";
import { statement } from "../../src/db/client";
import { withRuntime, type WorkerEnv } from "../../src/runtime/env";
import { bindingName, requiredTiers } from "../../src/policies/rate-counter";

export async function createTestRuntime(): Promise<{ env: WorkerEnv; db: TestDatabase; caches: CacheStorage; dispose: () => Promise<void> }> {
  const db = new TestDatabase();
  await db.migrate();
  const mf = new Miniflare({ workers: [{ config: {
    name: "postgres-tests", compatibilityDate: "2026-10-02",
    manifest: { mainModule: "index.js", modules: { "index.js": { type: "esm", contents: "export default { fetch() { return new Response('ok'); } }" } } },
    env: Object.fromEntries(requiredTiers().map((tier, index) => [bindingName(tier), { type: "rate-limit" as const, namespace: String(index+1), simple: { period: tier.period, limit: 1_000_000 } }])),
  } }] });
  const bindings = await mf.getBindings();
  return { db, caches: await mf.getCaches() as unknown as CacheStorage,
    env: { ...bindings, DATABASE_URL: db.url, MODE: "dev", FRONTEND_URL: "http://localhost:3000" },
    dispose: async () => { await mf.dispose(); await db.close(); },
  };
}

export async function seedUser(
  env: WorkerEnv,
  uid = "user1",
  name = uid,
): Promise<void> {
  const data = {
    _id: uid.padStart(24, "0"),
    uid,
    name,
    email: `${uid}@example.com`,
    addedAt: 0,
    personalBests: { time: {}, words: {}, quote: {}, zen: {}, custom: {} },
    testActivity: {},
  };
  await withRuntime(env, async () => await statement(
    "INSERT INTO users (uid,id,name,name_key,email,added_at,data) VALUES (?,?,?,?,?,?,?)",
    uid, uid.padStart(24, "0"), name, name.toLowerCase(), data.email, 0, JSON.stringify(data),
  ).run());
}
