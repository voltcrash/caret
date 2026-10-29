import { createHmac } from "node:crypto";
import {
  Miniflare,
  Response as FixtureResponse,
  type MiniflareOptions,
} from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { withRuntime, type WorkerEnv } from "@caret/backend/runtime";
import { getAuth } from "@caret/backend/auth/session";
import { TestDatabase } from "../../../backend/__tests__/postgres/database";
import { bindingName, requiredTiers } from "@caret/backend/rate-counter";

const root = resolve(import.meta.dirname, "../../..");
const testSecret = "stage-one-local-only-secret-at-least-32-characters";

/** Lift named Workers rate limiting budgets for tests that repeat one operation. */
export function relaxRateLimits(
  ...names: string[]
): (options: MiniflareOptions) => void {
  return (options) => {
    for (const worker of "workers" in options ? options.workers : []) {
      const env = (worker as { config: { env: object } }).config.env as Record<
        string,
        { simple?: { limit: number } }
      >;
      for (const name of names) {
        const simple = env[name]?.simple;
        if (simple !== undefined) simple.limit = 1000;
      }
    }
  };
}

/** Spend a client's root budget (67 per minute) on health checks. */
export async function exhaustRootLimit(
  mf: FixtureWorker,
  worker: string,
  ip: string,
): Promise<void> {
  const target = await mf.getWorker(worker);
  // Headroom: the fixed one-minute window may roll over mid-loop.
  for (let sent = 0; sent < 2 * 67 + 1; sent++) {
    const response = await target.fetch("http://localhost:3000/api/", {
      headers: { "cf-connecting-ip": ip },
    });
    await response.arrayBuffer();
    if (response.status === 429) return;
  }
  throw new Error("Root limit never applied");
}

export class FixtureWorker extends Miniflare {
  readonly databases: Map<string, TestDatabase>;
  constructor(options: MiniflareOptions, databases: Map<string, TestDatabase>) {
    super(options);
    this.databases = databases;
  }
  async getDatabase(name = "a"): Promise<TestDatabase> {
    const database = this.databases.get(name);
    if (!database) throw new Error("Missing PostgreSQL fixture");
    return database;
  }
  override async dispose(): Promise<void> {
    await super.dispose();
    for (const db of this.databases.values()) await db.close();
  }
}

export async function createWorkerd(
  testEntry = false,
  port?: number,
  captcha = false,
  overrides: Partial<
    Pick<
      WorkerEnv,
      | "MODE"
      | "API_PATH_OVERRIDE"
      | "FRONTEND_URL"
      | "BETTER_AUTH_URL"
      | "GITHUB_CLIENT_ID"
      | "GITHUB_CLIENT_SECRET"
      | "PLACEMENT_MODE"
    >
  > = {},
  fixture: {
    build?: string;
    instrument?: string;
    onReady?: (milliseconds: number) => void;
    onOptions?: (options: MiniflareOptions) => void;
  } = {},
): Promise<FixtureWorker> {
  const dir = resolve(
    root,
    `frontend/dist/${fixture.build ?? (testEntry ? "start-test" : "start")}/server`,
  );
  // Wasm the Worker imports (`.wasm?module`) uploads as a precompiled module,
  // exactly as wrangler deploys it.
  const modules = Object.fromEntries(
    readdirSync(dir, { recursive: true, encoding: "utf8" })
      .filter(
        (name) =>
          typeof name === "string" &&
          (name.endsWith(".js") || name.endsWith(".wasm")),
      )
      .map((name) => [
        relative(dir, resolve(dir, name)).replaceAll("\\", "/"),
        name.endsWith(".wasm")
          ? {
              type: "wasm" as const,
              contents: new Uint8Array(readFileSync(resolve(dir, name))),
            }
          : {
              type: "esm" as const,
              contents: readFileSync(resolve(dir, name), "utf8"),
            },
      ]),
  );
  const origin =
    port === undefined ? "http://localhost:3000" : `http://127.0.0.1:${port}`;
  if (fixture.instrument !== undefined) {
    modules["instrument.js"] = { type: "esm", contents: fixture.instrument };
  }
  const databases = new Map<string, TestDatabase>();
  for (const name of ["a", "b"]) {
    const db = new TestDatabase();
    await db.migrate();
    databases.set(name, db);
  }
  const started = performance.now();
  const options: MiniflareOptions = {
    ...(port === undefined ? {} : { port, host: "127.0.0.1" }),
    workers: ["a", "b"].map((name, worker) => ({
      config: {
        name,
        compatibilityDate: "2026-10-02",
        compatibilityFlags: ["nodejs_compat"],
        assets: {
          directory: resolve(dir, "../client"),
          hasUserWorker: true,
          htmlHandling: "none",
          notFoundHandling: "none",
          runWorkerFirst: false,
        },
        manifest: {
          mainModule:
            fixture.instrument === undefined ? "index.js" : "instrument.js",
          modules,
        },
        env: {
          HYPERDRIVE: {
            type: "hyperdrive" as const,
            id: "00000000000000000000000000000000",
            dev: { connectionString: databases.get(name)?.url ?? "" },
          },
          ASSETS: { type: "assets" as const },
          METRICS: {
            type: "analytics-engine-dataset" as const,
            name: `requests-${name}`,
          },
          ...Object.fromEntries(
            requiredTiers().map((tier, index) => [
              bindingName(tier),
              {
                type: "rate-limit" as const,
                namespace: String((worker + 1) * 1000 + index + 1),
                simple: { ...tier },
              },
            ]),
          ),
          ...(captcha
            ? {
                TURNSTILE_SECRET_KEY: {
                  type: "text" as const,
                  value: "local-test-turnstile",
                },
              }
            : {}),
          MODE: { type: "text" as const, value: "production" },
          VERSION: { type: "text" as const, value: name },
          FRONTEND_URL: {
            type: "text" as const,
            value: origin,
          },
          BETTER_AUTH_URL: {
            type: "text" as const,
            value: `${origin}/api/auth`,
          },
          BETTER_AUTH_SECRET: { type: "text" as const, value: testSecret },
          // Tests change configuration with SQL and expect the next request to see it.
          CONFIGURATION_CACHE_TTL_MS: { type: "text" as const, value: "0" },
          ...Object.fromEntries(
            Object.entries(overrides).flatMap(([key, value]) =>
              value === undefined
                ? []
                : [[key, { type: "text" as const, value }]],
            ),
          ),
        },
      },
      dev: {
        outboundService: {
          type: "fetcher" as const,
          handler: async (request: import("miniflare").Request) => {
            if (
              captcha &&
              request.url ===
                "https://challenges.cloudflare.com/turnstile/v0/siteverify"
            ) {
              return FixtureResponse.json({
                success: true,
                hostname: "localhost",
                action: "signup",
              });
            }
            throw new Error(`Unexpected outbound HTTP: ${request.url}`);
          },
        },
      },
    })),
  };
  fixture.onOptions?.(options);
  const mf = new FixtureWorker(options, databases);
  await mf.ready;
  fixture.onReady?.(performance.now() - started);
  for (const name of ["a", "b"]) {
    const db = await mf.getDatabase(name);
    await db
      .prepare("INSERT INTO configuration(id,data) VALUES('main',?)")
      .bind(JSON.stringify({ users: { signUp: true } }))
      .run();
    await db
      .prepare(
        "INSERT INTO public_stats(id,tests_completed,tests_started,time_typing) VALUES('stats',?,?,?)",
      )
      .bind(name === "a" ? 11 : 22, 33, 44)
      .run();
    await db
      .prepare("CREATE TABLE probe(actor TEXT, version TEXT, isolated INTEGER)")
      .run();
  }
  return mf;
}

export async function seedSession(
  mf: FixtureWorker,
  worker: string,
): Promise<{ uid: string; token: string; cookie: string }> {
  const db = await mf.getDatabase(worker);
  const env = {
    HYPERDRIVE: { connectionString: db.url },
    MODE: "production",
    FRONTEND_URL: "http://localhost:3000",
    BETTER_AUTH_URL: "http://localhost:3000/api/auth",
    BETTER_AUTH_SECRET: testSecret,
  } as WorkerEnv;
  return await withRuntime(env, async () => {
    const auth = await getAuth().$context;
    const user = await auth.internalAdapter.createUser(
      {
        name: worker,
        email: `${worker}-${crypto.randomUUID()}@example.test`,
        emailVerified: true,
      },
      { method: "oauth", oauth: { providerId: "github" } },
    );
    const session = await auth.internalAdapter.createSession(user.id, false);
    if (session === null) throw new Error("Missing fixture session");
    return {
      uid: user.id,
      token: session.token,
      cookie: `caret.session_token=${encodeURIComponent(`${session.token}.${createHmac("sha256", testSecret).update(session.token).digest("base64")}`)}`,
    };
  });
}

/** A complete public user with one time 60 personal best. */
export async function seedProfile(
  mf: FixtureWorker,
  worker: string,
  name: string,
): Promise<string> {
  const db = await mf.getDatabase(worker);
  const uid = `profile-${name}`;
  const pb = {
    acc: 97.5,
    consistency: 80,
    difficulty: "normal",
    language: "english",
    raw: 130,
    wpm: 123.4,
    timestamp: 1_700_000_000_000,
  };
  const data = {
    _id: uid.padStart(24, "0"),
    uid,
    name,
    email: `${uid}@example.test`,
    addedAt: 1_700_000_000_000,
    personalBests: {
      time: { "60": [pb] },
      words: {},
      quote: {},
      zen: {},
      custom: {},
    },
    completedTests: 5,
    startedTests: 9,
    timeTyping: 600.125,
    profileDetails: { bio: `${name} public bio` },
    testActivity: {},
  };
  await db
    .prepare(
      "INSERT INTO users(uid,id,name,name_key,email,added_at,data) VALUES(?,?,?,?,?,?,?)",
    )
    .bind(
      uid,
      data._id,
      name,
      name.toLowerCase(),
      data.email,
      data.addedAt,
      JSON.stringify(data),
    )
    .run();
  return uid;
}

/** Enables the public features a test exercises. */
export async function enableConfiguration(
  mf: FixtureWorker,
  worker: string,
  path: string,
  value: unknown,
): Promise<void> {
  const db = await mf.getDatabase(worker);
  let patch: unknown = value;
  for (const key of path.replace(/^\$\./, "").split(".").reverse()) {
    patch = { [key]: patch };
  }
  await db
    .prepare(
      "UPDATE configuration SET data=jsonb_merge_patch(data,?::jsonb) WHERE id='main'",
    )
    .bind(JSON.stringify(patch))
    .run();
}

/** All-time English time 15 board with `count` ranked entries. */
export async function seedLeaderboard(
  mf: FixtureWorker,
  worker: string,
  count: number,
): Promise<void> {
  const db = await mf.getDatabase(worker);
  const board = "english_time_15";
  await db
    .prepare(
      "INSERT INTO leaderboard_generations(board,generation,updated_at) VALUES(?,'fixture',1)",
    )
    .bind(board)
    .run();
  await db.batch(
    Array.from({ length: count }, (_, i) =>
      db
        .prepare(
          "INSERT INTO users(uid,id,name,name_key,email,added_at,data) VALUES(?,?,?,?,?,0,'{}')",
        )
        .bind(
          `racer-${i + 1}`,
          `racer-${i + 1}`.padStart(24, "0"),
          `racer-${i + 1}`,
          `racer-${i + 1}`,
          `racer-${i + 1}@example.test`,
        ),
    ),
  );
  await db.batch(
    Array.from({ length: count }, (_, i) =>
      db
        .prepare(
          "INSERT INTO leaderboard_snapshots(generation,board,uid,rank,data) VALUES('fixture',?,?,?,?)",
        )
        .bind(
          board,
          `racer-${i + 1}`,
          i + 1,
          JSON.stringify({
            wpm: 200 - i,
            acc: 99,
            raw: 205 - i,
            consistency: 80,
            timestamp: 1_700_000_000_000,
            uid: `racer-${i + 1}`,
            name: `racer-${i + 1}`,
          }),
        ),
    ),
  );
}
