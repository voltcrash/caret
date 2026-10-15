import { Miniflare } from "miniflare";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import objectHash from "object-hash";
import type { WorkerEnv } from "../src/runtime/env";
import { withRuntime } from "../src/runtime/env";
import { getAuth } from "../src/init/auth";
import { patchConfiguration } from "../src/init/configuration";
import * as Users from "../src/dal/user";
import { mutateUser } from "../src/db/mutation";
import { scoreEvent } from "../__tests__/d1/result-support";

const root = resolve(__dirname, "../..");
const bundle = readFileSync(resolve(root, "backend/dist/worker/worker.js"));
const wrapper = `
import Worker from './worker.js';
export default {
  async fetch(request, env, ctx) {
    let count = 0;
    const originals = new WeakMap();
    const wrap = (stmt) => {
      const proxy = new Proxy(stmt, { get(target, key) {
        if (key === 'bind') return (...args) => wrap(target.bind(...args));
        if (['first', 'all', 'run', 'raw'].includes(key)) return (...args) => { count++; return target[key](...args); };
        return Reflect.get(target, key);
      }});
      originals.set(proxy, stmt);
      return proxy;
    };
    const db = { prepare: (sql) => wrap(env.DB.prepare(sql)),
      batch: (stmts) => { count += stmts.length; return env.DB.batch(stmts.map(s => originals.get(s) ?? s)); },
      exec: (sql) => { count++; return env.DB.exec(sql); }
    };
    const response = await Worker.fetch(request, { ...env, DB: db }, ctx);
    const result = new Response(response.body, response);
    result.headers.set('X-Baseline-Queries', String(count));
    return result;
  }
};`;

// Process CPU includes local D1 and workerd overhead. Never label it edge CPU.
function workerdPid(): number {
  const rows = execFileSync("vp", ["exec", "ps", "-axo", "pid=,ppid=,comm="], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/));
  const descendants = new Set([process.pid]);
  for (let pass = 0; pass < 5; pass++) {
    for (const row of rows) {
      if (descendants.has(Number(row[1]))) descendants.add(Number(row[0]));
    }
  }
  const row = rows.find(
    (row) =>
      descendants.has(Number(row[0])) &&
      row.slice(2).join(" ").endsWith("/workerd"),
  );
  if (row === undefined) throw new Error("Missing benchmark workerd process");
  return Number(row[0]);
}

function cpuMs(pid: number): number {
  const value = execFileSync(
    "vp",
    ["exec", "ps", "-o", "time=", "-p", String(pid)],
    { encoding: "utf8" },
  ).trim();
  return (
    value.split(":").reduce((sum, part) => sum * 60 + Number(part), 0) * 1000
  );
}

async function main(): Promise<void> {
  const output = process.argv[2];
  if (output === undefined) throw new Error("Provide output JSON path");
  const startup: number[] = [];
  const save: number[] = [];
  const cpu: number[] = [];
  const queries: Record<string, number[]> = {};
  for (let sample = 0; sample < 5; sample++) {
    const start = performance.now();
    const mf = new Miniflare({
      workers: [
        {
          config: {
            name: "migration-baseline",
            compatibilityDate: "2026-10-02",
            manifest: {
              mainModule: "entry.js",
              modules: {
                "entry.js": { type: "esm", contents: wrapper },
                "worker.js": { type: "esm", contents: bundle.toString() },
              },
            },
            env: {
              DB: { type: "d1", name: "baseline", id: "baseline" },
              MODE: { type: "text", value: "production" },
              FRONTEND_URL: { type: "text", value: "http://localhost:3000" },
              BETTER_AUTH_URL: {
                type: "text",
                value: "http://localhost:5005/api/auth",
              },
              BETTER_AUTH_SECRET: {
                type: "text",
                value: "stage-zero-local-only-secret-at-least-32-characters",
              },
            },
          },
        },
      ],
    });
    try {
      await mf.ready;
      startup.push(performance.now() - start);
      const db = await mf.getD1Database("DB");
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
            .filter((query) => query.trim())
            .map((query) => db.prepare(query)),
        );
      }
      const env = {
        DB: db,
        MODE: "production",
        FRONTEND_URL: "http://localhost:3000",
        BETTER_AUTH_URL: "http://localhost:5005/api/auth",
        BETTER_AUTH_SECRET:
          "stage-zero-local-only-secret-at-least-32-characters",
      } as WorkerEnv;
      const account = await withRuntime(env, async () => {
        await patchConfiguration({
          results: { savingEnabled: true, objectHashCheckEnabled: true },
        });
        const auth = await getAuth().$context;
        const user = await auth.internalAdapter.createUser(
          {
            name: "Baseline",
            email: "baseline@example.test",
            emailVerified: true,
          },
          { method: "oauth", oauth: { providerId: "github" } },
        );
        await Users.addUser(user.name, user.email, user.id);
        await mutateUser(user.id, (profile) => {
          profile.addedAt = 0;
          profile.timeTyping = 1;
        });
        const session = await auth.internalAdapter.createSession(
          user.id,
          false,
        );
        if (session === null) throw new Error("Missing fixture session");
        return { uid: user.id, token: session.token };
      });
      const request = async (path: string, body?: unknown): Promise<number> => {
        const response = await mf.dispatchFetch(
          `http://localhost:5005/api${path}`,
          {
            method: body === undefined ? "GET" : "POST",
            headers: {
              authorization: `Bearer ${account.token}`,
              "content-type": "application/json",
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          },
        );
        const data: unknown = await response.json();
        if (response.status !== 200) {
          throw new Error(
            `${path}: ${response.status} ${JSON.stringify(data)}`,
          );
        }
        const count = response.headers.get("X-Baseline-Queries");
        if (
          count === null ||
          !Number.isSafeInteger(Number(count)) ||
          Number(count) < 0
        ) {
          throw new Error(`Missing or invalid D1 instrumentation for ${path}`);
        }
        return Number(count);
      };
      for (const path of [
        "/configuration",
        "/public/typingStats",
        "/users",
        "/results?limit=1000",
      ]) {
        (queries[path] ??= []).push(await request(path));
      }
      for (let index = 0; index < 10; index++) {
        const { hash: _hash, ...payload } = scoreEvent(account.uid, 80, index, {
          timestamp: Date.now(),
        });
        const before = performance.now();
        (queries["POST /results"] ??= []).push(
          await request("/results", {
            result: { ...payload, hash: objectHash(payload) },
          }),
        );
        save.push(performance.now() - before);
        await db
          .prepare("UPDATE results SET timestamp=timestamp-120000 WHERE uid=?")
          .bind(account.uid)
          .run();
      }
      const saved = await db
        .prepare("SELECT count(*) AS count FROM results WHERE uid=?")
        .bind(account.uid)
        .first<number>("count");
      if (saved !== 10) {
        throw new Error(`Expected 10 persisted results, got ${saved}`);
      }
      (queries["/results?limit=1000 (10 rows)"] ??= []).push(
        await request("/results?limit=1000"),
      );
      const pid = workerdPid();
      const before = cpuMs(pid);
      for (let index = 0; index < 50; index++) {
        await request("/public/typingStats");
      }
      cpu.push((cpuMs(pid) - before) / 50);
    } finally {
      await mf.dispose();
    }
  }
  writeFileSync(
    output,
    `${JSON.stringify({ fixture: "built legacy Worker in local workerd + fresh migrated D1, one authenticated user, 10 unique valid saves per instance; no remote traffic", worker: { raw: bundle.length, gzip: gzipSync(bundle).length }, startup, save, cpuMsPerPublicRead: cpu, queries }, null, 2)}\n`,
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
