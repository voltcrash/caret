import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import { gzipSync } from "node:zlib";
import { fromCrossJSON, toJSONAsync, type SerovalNode } from "seroval";
import { legacyHash as objectHash } from "@caret/web-shared/legacy-hash";
import { z } from "zod";
import { scoreEvent } from "../../../backend/__tests__/postgres/result-support";
import { createWorkerd, enableConfiguration, seedSession } from "./workerd";
import { rpcPath } from "./rpc";

let mf: Awaited<ReturnType<typeof createWorkerd>>;
beforeAll(async () => {
  mf = await createWorkerd();
  await enableConfiguration(mf, "a", "$.results", {
    savingEnabled: true,
    objectHashCheckEnabled: true,
  });
});
afterAll(async () => await mf?.dispose());

/** Save one result through the server function, then clone `count` older results with varied scores. */
async function seedHistory(count: number): Promise<{ token: string }> {
  const session = await seedSession(mf, "a");
  const db = await mf.getDatabase("a");
  const user = {
    _id: crypto.randomUUID().replaceAll("-", "").slice(0, 24),
    uid: session.uid,
    name: "History",
    email: "history@example.test",
    addedAt: 0,
    personalBests: { time: {}, words: {}, quote: {}, zen: {}, custom: {} },
    testActivity: {},
    timeTyping: 1,
  };
  await db
    .prepare(
      "INSERT INTO users(uid,id,name,name_key,email,added_at,time_typing,data) VALUES(?,?,?,'history',?,0,1,?)",
    )
    .bind(session.uid, user._id, user.name, user.email, JSON.stringify(user))
    .run();
  const { hash: _hash, ...result } = scoreEvent(session.uid, 80);
  const worker = await mf.getWorker("a");
  const saved = await worker.fetch(
    `http://localhost:3000${rpcPath("resultsAdd")}`,
    {
      method: "POST",
      headers: headers(session.token),
      body: JSON.stringify(
        await toJSONAsync({
          data: { body: { result: { ...result, hash: objectHash(result) } } },
        }),
      ),
    },
  );
  expect(saved.status).toBe(200);
  await db
    .prepare(
      `INSERT INTO results(id,uid,timestamp,mode,mode2,language,wpm,acc,client,submission_hash,data)
      SELECT substr(md5(r.uid || g), 1, 24), r.uid, r.timestamp - g * 60000, r.mode,
        v.mode2, r.language, v.wpm, v.acc, r.client, v.hash,
        (r.data - 'isPb') || jsonb_build_object(
          'wpm', v.wpm, 'rawWpm', round(v.wpm * 1.06, 2), 'acc', v.acc,
          'consistency', round(55 + (g * 389 % 4000) / 100.0, 2),
          'keyConsistency', round(50 + (g * 617 % 4500) / 100.0, 2),
          'timestamp', r.timestamp - g * 60000, 'mode2', v.mode2,
          'testDuration', v.mode2::int,
          'charStats', jsonb_build_array(round(v.wpm * v.mode2::int / 12), g % 9, g % 4, g % 3),
          'submissionHash', v.hash)
      FROM results r, generate_series(1, ?) g,
        LATERAL (SELECT round(40 + (g * 7919 % 9000) / 100.0, 2) AS wpm,
          round(88 + (g * 104729 % 1200) / 100.0, 2) AS acc,
          (ARRAY['15', '30', '60'])[1 + g % 3] AS mode2,
          substr(encode(sha256(('hash' || g)::bytea), 'hex'), 1, 40) AS hash) v
      WHERE r.uid = ?`,
    )
    .bind(count, session.uid)
    .run();
  return session;
}

function headers(token: string): Record<string, string> {
  return {
    origin: "http://localhost:3000",
    "x-tsr-serverFn": "true",
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  };
}

it("serves the account page at most 1,000 results in under 62 KB of gzip", async () => {
  const session = await seedHistory(1099);
  const payload = JSON.stringify(
    await toJSONAsync({ data: { query: { client: "web" } } }),
  );
  const worker = await mf.getWorker("a");
  const response = await worker.fetch(
    `http://localhost:3000${rpcPath("resultsGet")}?payload=${encodeURIComponent(payload)}`,
    { headers: headers(session.token) },
  );
  const body = await response.text();
  expect(response.status).toBe(200);
  const { result } = z
    .object({
      result: z.object({ ok: z.literal(true), data: z.array(z.unknown()) }),
    })
    .parse(fromCrossJSON(JSON.parse(body) as SerovalNode, { refs: new Map() }));
  expect(result.data).toHaveLength(1000);
  // Default gzip level; Cloudflare's edge compression differs slightly.
  expect(gzipSync(body).length).toBeLessThan(62_000);
});
