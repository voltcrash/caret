import { Miniflare } from "miniflare";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { withRuntime, type WorkerEnv } from "@oxytype/backend/runtime";
import { getAuth } from "@oxytype/backend/auth/session";

const root = resolve(import.meta.dirname, "../../..");
const testSecret = "stage-one-local-only-secret-at-least-32-characters";

export async function createWorkerd(
  testEntry = false,
  port?: number,
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
          MODE: { type: "text" as const, value: "production" },
          VERSION: { type: "text" as const, value: name },
          FRONTEND_URL: {
            type: "text" as const,
            value: "http://localhost:3000",
          },
          BETTER_AUTH_URL: {
            type: "text" as const,
            value: "http://localhost:3000/api/auth",
          },
          BETTER_AUTH_SECRET: { type: "text" as const, value: testSecret },
        },
      },
      dev: {
        outboundService: {
          type: "fetcher" as const,
          handler: (request: { url: string }) => {
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
): Promise<{ uid: string; token: string }> {
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
      { name: worker, email: `${worker}@example.test`, emailVerified: true },
      { method: "oauth", oauth: { providerId: "github" } },
    );
    const session = await auth.internalAdapter.createSession(user.id, false);
    if (session === null) throw new Error("Missing fixture session");
    return { uid: user.id, token: session.token };
  });
}
