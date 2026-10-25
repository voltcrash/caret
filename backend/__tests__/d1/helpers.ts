import { Miniflare } from "miniflare";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { WorkerEnv } from "../../src/runtime/env";
import type { D1Database } from "@cloudflare/workers-types";
import { bindingName, requiredTiers } from "../../src/policies/rate-counter";

export async function createTestRuntime(options?: {
  beforeMigration?: (db: D1Database, file: string) => Promise<void>;
}): Promise<{
  env: WorkerEnv;
  caches: CacheStorage;
  dispose: () => Promise<void>;
}> {
  const mf = new Miniflare({
    workers: [
      {
        config: {
          name: "d1-tests",
          compatibilityDate: "2026-10-02",
          manifest: {
            mainModule: "index.js",
            modules: {
              "index.js": {
                type: "esm",
                contents:
                  "export default { fetch() { return new Response('ok'); } }",
              },
            },
          },
          env: {
            DB: { type: "d1", name: "d1-tests", id: "d1-tests" },
            // Limiter state outlives each case, so budgets here never bind;
            // workerd suites exercise the real budgets.
            ...Object.fromEntries(
              requiredTiers().map((tier, index) => [
                bindingName(tier),
                {
                  type: "rate-limit" as const,
                  namespace: String(index + 1),
                  simple: { period: tier.period, limit: 1_000_000 },
                },
              ]),
            ),
          },
        },
      },
    ],
  });
  const db = await mf.getD1Database("DB");
  const migrations = resolve(__dirname, "../../migrations");
  for (const file of (await readdir(migrations))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    await options?.beforeMigration?.(db, file);
    const queries = (await readFile(resolve(migrations, file), "utf8"))
      .split("--> statement-breakpoint")
      .filter((query) => query.trim());
    await db.batch(queries.map((query) => db.prepare(query)));
  }
  const bindings = await mf.getBindings();
  return {
    caches: (await mf.getCaches()) as unknown as CacheStorage,
    env: {
      ...Object.fromEntries(
        Object.entries(bindings).filter(([name]) =>
          name.startsWith("RATE_LIMIT_"),
        ),
      ),
      DB: db,
      MODE: "dev",
      FRONTEND_URL: "http://localhost:3000",
    },
    dispose: async () => await mf.dispose(),
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
  await env.DB.prepare(
    "INSERT INTO users (uid,id,name,name_key,email,added_at,data) VALUES (?,?,?,?,?,?,?)",
  )
    .bind(
      uid,
      uid.padStart(24, "0"),
      name,
      name.toLowerCase(),
      data.email,
      0,
      JSON.stringify(data),
    )
    .run();
}
