import { createHmac } from "node:crypto";
import { Miniflare, Response as FixtureResponse } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { withRuntime, type WorkerEnv } from "@oxytype/backend/runtime";
import { getAuth } from "@oxytype/backend/auth/session";

const root = resolve(import.meta.dirname, "../../..");
const testSecret = "stage-one-local-only-secret-at-least-32-characters";

export async function createWorkerd(
  testEntry = false,
  port?: number,
  captcha = false,
): Promise<Miniflare> {
  const dir = resolve(
    root,
    `frontend/dist/${testEntry ? "start-test" : "start"}/server`,
  );
  const modules = Object.fromEntries(
    readdirSync(dir, { recursive: true, encoding: "utf8" })
      .filter((name) => typeof name === "string" && name.endsWith(".js"))
      .map((name) => [
        relative(dir, resolve(dir, name)).replaceAll("\\", "/"),
        {
          type: "esm" as const,
          contents: readFileSync(resolve(dir, name), "utf8"),
        },
      ]),
  );
  const origin =
    port === undefined ? "http://localhost:3000" : `http://127.0.0.1:${port}`;
  const mf = new Miniflare({
    ...(port === undefined ? {} : { port, host: "127.0.0.1" }),
    workers: ["a", "b"].map((name) => ({
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
        manifest: { mainModule: "index.js", modules },
        env: {
          DB: { type: "d1" as const, name, id: name },
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
        },
      },
      dev: {
        outboundService: {
          type: "fetcher" as const,
          handler: (request: { url: string }) => {
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
  });
  for (const name of ["a", "b"]) {
    const db = await mf.getD1Database("DB", name);
    for (const file of readdirSync(resolve(root, "backend/migrations"))
      .filter((file) => file.endsWith(".sql"))
      .sort()) {
      const sql = readFileSync(
        resolve(root, "backend/migrations", file),
        "utf8",
      );
      await db.batch(
        sql
          .split("--> statement-breakpoint")
          .filter((sql) => sql.trim())
          .map((sql) => db.prepare(sql)),
      );
    }
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
  mf: Miniflare,
  worker: string,
): Promise<{ uid: string; token: string; cookie: string }> {
  const db = await mf.getD1Database("DB", worker);
  const env = {
    DB: db,
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
      cookie: `oxytype.session_token=${encodeURIComponent(`${session.token}.${createHmac("sha256", testSecret).update(session.token).digest("base64")}`)}`,
    };
  });
}

/** A complete public user with one time 60 personal best. */
export async function seedProfile(
  mf: Miniflare,
  worker: string,
  name: string,
): Promise<string> {
  const db = await mf.getD1Database("DB", worker);
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
    timeTyping: 600,
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
  mf: Miniflare,
  worker: string,
  path: string,
  value: unknown,
): Promise<void> {
  const db = await mf.getD1Database("DB", worker);
  await db
    .prepare(
      "UPDATE configuration SET data=json_set(data,?,json(?)) WHERE id='main'",
    )
    .bind(path, JSON.stringify(value))
    .run();
}

/** All-time English time 15 board with `count` ranked entries. */
export async function seedLeaderboard(
  mf: Miniflare,
  worker: string,
  count: number,
): Promise<void> {
  const db = await mf.getD1Database("DB", worker);
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
