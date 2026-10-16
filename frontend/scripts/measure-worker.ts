import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { fromCrossJSON, toJSONAsync, type SerovalNode } from "seroval";
import objectHash from "object-hash";
import { z } from "zod";
import { withRuntime } from "@oxytype/backend/runtime";
import * as Users from "../../backend/src/dal/user";
import { mutateUser } from "../../backend/src/db/mutation";
import { scoreEvent } from "../../backend/__tests__/d1/result-support";
import {
  createWorkerd,
  enableConfiguration,
  seedSession,
} from "../__tests__/start/workerd";
import { rpcPath } from "../__tests__/start/rpc";

// Test-only D1 boundary instrumentation, identical counting rules to Stage 0.
const probe = `import Worker from './index.js';
export default { async fetch(request, env, ctx) {
  let count = 0; const originals = new WeakMap();
  const wrap = stmt => { const proxy = new Proxy(stmt, { get(target, key) {
    if (key === 'bind') return (...args) => wrap(target.bind(...args));
    if (['first', 'all', 'run', 'raw'].includes(key)) return (...args) => { count++; return target[key](...args); };
    return Reflect.get(target, key);
  }}); originals.set(proxy, stmt); return proxy; };
  const db = { prepare: sql => wrap(env.DB.prepare(sql)),
    batch: stmts => { count += stmts.length; return env.DB.batch(stmts.map(s => originals.get(s) ?? s)); },
    exec: sql => { count++; return env.DB.exec(sql); }
  };
  const response = await Worker.fetch(request, {...env, DB: db}, ctx);
  const result = new Response(response.body, response);
  result.headers.set('X-Baseline-Queries', String(count)); return result;
}};`;

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
  return (
    execFileSync("vp", ["exec", "ps", "-o", "time=", "-p", String(pid)], {
      encoding: "utf8",
    })
      .trim()
      .split(":")
      .reduce((sum, part) => sum * 60 + Number(part), 0) * 1000
  );
}

async function main(): Promise<void> {
  const output = process.argv[2];
  if (output === undefined) throw new Error("Provide output JSON path");
  const startup: number[] = [],
    save: number[] = [],
    cpu: number[] = [],
    ssr: number[] = [];
  const queries: Record<string, number[]> = {};
  for (let sample = 0; sample < 5; sample++) {
    const mf = await createWorkerd(
      false,
      undefined,
      false,
      {},
      { instrument: probe, onReady: (ms) => startup.push(ms) },
    );
    try {
      const db = await mf.getD1Database("DB", "a");
      await enableConfiguration(mf, "a", "$.results", {
        savingEnabled: true,
        objectHashCheckEnabled: true,
      });
      const account = await seedSession(mf, "a");
      await withRuntime({ DB: db, MODE: "production" }, async () => {
        await Users.addUser("Baseline", "baseline@example.test", account.uid);
        await mutateUser(account.uid, (profile) => {
          profile.addedAt = 0;
          profile.timeTyping = 1;
        });
      });
      const worker = await mf.getWorker("a");
      const request = async (
        name: string,
        data: unknown,
        post = false,
      ): Promise<number> => {
        const payload = JSON.stringify(await toJSONAsync({ data }));
        const response = await worker.fetch(
          `http://localhost:3000${rpcPath(name)}${post ? "" : `?payload=${encodeURIComponent(payload)}`}`,
          {
            method: post ? "POST" : "GET",
            headers: {
              authorization: `Bearer ${account.token}`,
              origin: "http://localhost:3000",
              "x-tsr-serverFn": "true",
              "content-type": "application/json",
            },
            ...(post ? { body: payload } : {}),
          },
        );
        const text = await response.text();
        if (response.status !== 200) {
          throw new Error(`${name}: ${response.status} ${text}`);
        }
        const decoded = z
          .object({
            result: z.object({
              ok: z.boolean().optional(),
              message: z.string().optional(),
            }),
          })
          .parse(
            fromCrossJSON(JSON.parse(text) as SerovalNode, { refs: new Map() }),
          );
        if (decoded.result.ok === false) {
          throw new Error(`${name}: ${decoded.result.message}`);
        }
        const count = response.headers.get("X-Baseline-Queries");
        if (
          count === null ||
          !Number.isSafeInteger(Number(count)) ||
          Number(count) < 0
        ) {
          throw new Error(`Missing instrumentation for ${name}`);
        }
        return Number(count);
      };
      for (const [key, name, data] of [
        ["/configuration", "configurationGet", {}],
        ["/public/typingStats", "getTypingStats", undefined],
        ["/users", "usersGet", { query: { client: "web" } }],
        [
          "/results?limit=1000",
          "resultsGet",
          { query: { client: "web", limit: 1000 } },
        ],
      ] as const) {
        (queries[key] ??= []).push(await request(name, data));
      }
      for (let index = 0; index < 10; index++) {
        const { hash: _hash, ...payload } = scoreEvent(account.uid, 80, index, {
          timestamp: Date.now(),
        });
        const result = { ...payload, hash: objectHash(payload) };
        const before = performance.now();
        (queries["POST /results"] ??= []).push(
          await request("resultsAdd", { body: { result } }, true),
        );
        save.push(performance.now() - before);
        await db
          .prepare("UPDATE results SET timestamp=timestamp-120000 WHERE uid=?")
          .bind(account.uid)
          .run();
      }
      if (
        (await db
          .prepare("SELECT count(*) AS n FROM results WHERE uid=?")
          .bind(account.uid)
          .first<number>("n")) !== 10
      ) {
        throw new Error("Expected 10 unique persisted results");
      }
      (queries["/results?limit=1000 (10 rows)"] ??= []).push(
        await request("resultsGet", { query: { client: "web", limit: 1000 } }),
      );
      const pid = workerdPid();
      const before = cpuMs(pid);
      for (let index = 0; index < 50; index++) {
        await request("getTypingStats", undefined);
      }
      cpu.push((cpuMs(pid) - before) / 50);
      for (let index = 0; index < 10; index++) {
        const before = performance.now();
        const response = await worker.fetch("http://localhost:3000/about", {
          headers: { "cf-connecting-ip": "192.0.2.42" },
        });
        if (response.status !== 200) throw new Error("SSR failed");
        await response.text();
        ssr.push(performance.now() - before);
      }
    } finally {
      await mf.dispose();
    }
  }
  const directory = resolve(import.meta.dirname, "../dist/start/server");
  const modules = readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".js"))
    .map((name) => readFileSync(resolve(directory, name)));
  writeFileSync(
    output,
    `${JSON.stringify({ fixture: "Built Start Worker/local workerd; native RPC; fresh D1 per sample, same scoring/counting as Stage 0. CPU is local process CPU, never edge CPU. SSR is warm /about wall time; process startup excludes D1 setup.", workerModules: { raw: modules.reduce((sum, data) => sum + data.length, 0), gzip: modules.reduce((sum, data) => sum + gzipSync(data).length, 0) }, startup, save, cpuMsPerPublicRead: cpu, queries, ssr }, null, 2)}\n`,
  );
}
void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
