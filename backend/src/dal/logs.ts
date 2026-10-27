import { and, count, desc, eq, gte, lt } from "drizzle-orm";
import { database, encode, statement } from "../db/client";
import { logs } from "../db/schema";
import { stage } from "../db/mutation";
import { newId } from "../utils/id";
async function insert(
  event: string,
  message: string | Record<string, unknown>,
  uid: string,
  important: boolean,
): Promise<void> {
  console.info(JSON.stringify({ event, uid, message }));
  await stage(
    statement(
      "INSERT INTO audit_logs(id,uid,event,timestamp,important,data) VALUES(?,?,?,?,?,?)",
      newId(),
      uid,
      event,
      Date.now(),
      important,
      encode({ message }),
    ),
  );
}
export async function addLog(
  event: string,
  message: string | Record<string, unknown>,
  uid = "",
): Promise<void> {
  await insert(event, message, uid, false);
}
export async function addImportantLog(
  event: string,
  message: string | Record<string, unknown>,
  uid = "",
): Promise<void> {
  await insert(event, message, uid, true);
}

export async function countUserLogs(
  uid: string,
  event: string,
  since: number,
): Promise<number> {
  const row = (await database()
    .select({ count: count() })
    .from(logs)
    .where(
      and(eq(logs.uid, uid), eq(logs.event, event), gte(logs.timestamp, since)),
    )
    .limit(1))[0];
  return row?.count ?? 0;
}
export type AuditLog = {
  id: string;
  uid: string;
  event: string;
  timestamp: number;
  message: Record<string, unknown>;
};
function message(data: Record<string, unknown>): Record<string, unknown> {
  const value = data["message"];
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : { value };
}
export async function getLogs(options: {
  event: string;
  uid?: string;
  before?: number;
  limit: number;
}): Promise<AuditLog[]> {
  const rows = await database()
    .select()
    .from(logs)
    .where(
      and(
        eq(logs.event, options.event),
        options.uid === undefined ? undefined : eq(logs.uid, options.uid),
        options.before === undefined
          ? undefined
          : lt(logs.timestamp, options.before),
      ),
    )
    .orderBy(desc(logs.timestamp), desc(logs.id))
    .limit(options.limit);
  return rows.map((row) => ({
    id: row.id,
    uid: row.uid,
    event: row.event,
    timestamp: row.timestamp,
    message: message(row.data),
  }));
}
export type LogCount = { key: string; count: number; users: number };
/** Counts of one event since a timestamp, grouped by a JSON path. */
export async function countLogs(
  event: string,
  since: number,
  path: string,
  array = false,
): Promise<LogCount[]> {
  // array paths hold several keys per log, e.g. every signal of a flag
  const query = array
    ? `SELECT j.value AS key, count(*)::integer AS count, count(DISTINCT l.uid)::integer AS users
       FROM audit_logs l, jsonb_array_elements_text(l.data #> ?::text[]) j(value)
       WHERE l.event=? AND l.timestamp>=? GROUP BY j.value ORDER BY count DESC`
    : `SELECT data #>> ?::text[] AS key, count(*)::integer AS count, count(DISTINCT uid)::integer AS users
       FROM audit_logs WHERE event=? AND timestamp>=? GROUP BY key ORDER BY count DESC`;
  const { results } = await statement(query, `{${path.replace(/^\$\./, "").split(".").join(",")}}`, event, since).all<{
    key: string | null;
    count: number;
    users: number;
  }>();
  return results.map((row) => ({ ...row, key: row.key ?? "unknown" }));
}
