import type { Client } from "@oxytype/schemas/shared";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import MonkeyError from "../utils/error";
import { database, encode, statement } from "../db/client";
import { stage } from "../db/mutation";
import { results } from "../db/schema";
import { exists, getTags } from "./user";
import { type DBResult, replaceLegacyValues } from "../utils/result";
function unpack(row: typeof results.$inferSelect): DBResult {
  return replaceLegacyValues({
    ...row.data,
    _id: row.id,
    uid: row.uid,
    client: row.client,
  } as DBResult);
}
export async function hasSubmissionHash(
  uid: string,
  hashes: string[],
): Promise<boolean> {
  return (
    (await database()
      .select({ id: results.id })
      .from(results)
      .where(and(eq(results.uid, uid), inArray(results.submissionHash, hashes)))
      .limit(1)
      .get()) !== undefined
  );
}
export async function addResult(
  uid: string,
  result: DBResult,
): Promise<{ insertedId: string }> {
  // Existence only; the full user is already loaded by callers.
  if (!(await exists(uid))) {
    throw new MonkeyError(404, "User not found", "add result");
  }
  result.uid ??= uid;
  await stage(
    statement(
      "INSERT INTO results(id,uid,timestamp,mode,mode2,language,wpm,acc,client,submission_hash,data) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      result._id,
      uid,
      result.timestamp,
      result.mode,
      result.mode2,
      result.language ?? "english",
      result.wpm,
      result.acc,
      result.client ?? "web",
      (result as DBResult & { submissionHash?: string }).submissionHash ?? null,
      encode(result),
    ),
  );
  return { insertedId: result._id };
}
export async function updateTags(
  uid: string,
  resultId: string,
  tags: string[],
): Promise<{
  acknowledged: boolean;
  matchedCount: number;
  modifiedCount: number;
}> {
  const allowed = new Set((await getTags(uid)).map((tag) => tag._id));
  if (tags.some((id) => !allowed.has(id))) {
    throw new MonkeyError(422, "One of the tag id's is not valid");
  }
  await getResult(uid, resultId);
  await stage(
    statement(
      "UPDATE results SET data=json_set(data,'$.tags',json(?)) WHERE id=? AND uid=?",
      encode(tags),
      resultId,
      uid,
    ),
  );
  return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
}
export async function getResult(uid: string, id: string): Promise<DBResult> {
  const row = await database()
    .select()
    .from(results)
    .where(
      and(eq(results.id, id), eq(results.uid, uid), eq(results.client, "web")),
    )
    .get();
  if (!row) throw new MonkeyError(404, "Result not found");
  return unpack(row);
}
export async function getLastResult(
  uid: string,
  client: Client = "web",
): Promise<DBResult> {
  const row = await database()
    .select()
    .from(results)
    .where(and(eq(results.uid, uid), eq(results.client, client)))
    .orderBy(desc(results.timestamp), desc(results.id))
    .get();
  if (!row) throw new MonkeyError(404, "No last result found");
  return unpack(row);
}
export async function getLastResultTimestamp(
  uid: string,
  client: Client = "web",
): Promise<number> {
  const row = await database()
    .select({ timestamp: results.timestamp })
    .from(results)
    .where(and(eq(results.uid, uid), eq(results.client, client)))
    .orderBy(desc(results.timestamp), desc(results.id))
    .get();
  if (!row) throw new MonkeyError(404, "No last result found");
  return row.timestamp;
}
type GetResultsOpts = {
  client?: Client;
  onOrAfterTimestamp?: number;
  limit?: number;
  offset?: number;
};
export async function getResults(
  uid: string,
  opts: GetResultsOpts = {},
): Promise<DBResult[]> {
  const timestamp = opts.onOrAfterTimestamp;
  const rows = await database()
    .select()
    .from(results)
    .where(
      and(
        eq(results.uid, uid),
        eq(results.client, opts.client ?? "web"),
        timestamp !== undefined && Number.isFinite(timestamp)
          ? gte(results.timestamp, timestamp)
          : undefined,
      ),
    )
    .orderBy(desc(results.timestamp), desc(results.id))
    .limit(Math.min(opts.limit ?? 1000, 1000))
    .offset(opts.offset ?? 0);
  return rows.map((row) => {
    const result = unpack(row);
    const {
      chartData: _chart,
      keySpacingStats: _spacing,
      keyDurationStats: _duration,
      name: _name,
      ...summary
    } = result;
    return summary as DBResult;
  });
}
