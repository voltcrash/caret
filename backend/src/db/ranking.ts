import type { Client } from "@oxytype/schemas/shared";
import type { D1PreparedStatement } from "@cloudflare/workers-types";
import { statement } from "./client";
export type RankingRow = {
  uid: string;
  data: string;
  rank: number;
  score: number;
  timeTypedSeconds?: number;
};
/** Table names are a closed union; all caller data uses bound parameters. */
export async function rankingPage(
  table: "daily_entries" | "weekly_entries",
  period: number,
  page: number,
  pageSize: number,
  board?: string,
  includeExpired = false,
  client: Client = "web",
): Promise<{ rows: RankingRow[]; count: number; minWpm: number }> {
  if (page < 0 || pageSize < 0) throw new Error("Invalid page or pageSize");
  const score = table === "daily_entries" ? "score" : "xp";
  const scope = `period=? AND expires_at>? ${board === undefined ? "" : "AND board=?"} ${table === "weekly_entries" ? "AND client=?" : ""}`;
  const values: (string | number)[] = [period, includeExpired ? 0 : Date.now()];
  if (board !== undefined) values.push(board);
  if (table === "weekly_entries") values.push(client);
  const offset = page * pageSize;
  // Walk the ranking index from the offset; a window function would rank
  // the whole board on every page.
  const [rows, summary] = await Promise.all([
    statement(
      `SELECT uid,data,${score} AS score${table === "weekly_entries" ? ",time_typed_seconds AS timeTypedSeconds" : ""} FROM ${table} WHERE ${scope} ORDER BY ${score} DESC,uid DESC LIMIT ? OFFSET ?`,
      ...values,
      Math.min(pageSize, 1000),
      offset,
    ).all<Omit<RankingRow, "rank">>(),
    statement(
      `SELECT count(*) AS count,coalesce(min(json_extract(data,'$.wpm')),0) AS minWpm FROM ${table} WHERE ${scope}`,
      ...values,
    ).first<{ count: number; minWpm: number }>(),
  ]);
  return {
    rows: rows.results.map((row, index) => ({
      ...row,
      rank: offset + index + 1,
    })),
    count: summary?.count ?? 0,
    minWpm: summary?.minWpm ?? 0,
  };
}
export async function rankingUser(
  table: "daily_entries" | "weekly_entries",
  period: number,
  uid: string,
  board?: string,
  client: Client = "web",
): Promise<RankingRow | null> {
  return await rankingUserStatement(
    table,
    period,
    uid,
    board,
    client,
  ).first<RankingRow>();
}

/** One user's row and rank; its result has at most one `RankingRow`. */
export function rankingUserStatement(
  table: "daily_entries" | "weekly_entries",
  period: number,
  uid: string,
  board?: string,
  client: Client = "web",
): D1PreparedStatement {
  const score = table === "daily_entries" ? "score" : "xp";
  const clientScope = table === "weekly_entries" ? "AND client=?" : "";
  const scope = `period=? AND expires_at>? ${board === undefined ? "" : "AND board=?"} ${clientScope}`;
  const scopeValues: (string | number)[] = [period, Date.now()];
  if (board !== undefined) scopeValues.push(board);
  if (table === "weekly_entries") scopeValues.push(client);
  // Read one profile, then count higher scores using the ranking index.
  const ahead = `SELECT count(*) FROM ${table} WHERE ${scope} AND (${score},uid)>(me.score,me.uid)`;
  return statement(
    `WITH me AS (SELECT uid,data,${score} AS score${table === "weekly_entries" ? ",time_typed_seconds AS timeTypedSeconds" : ""} FROM ${table} WHERE ${scope} AND uid=?) SELECT me.*,(1+(${ahead})) AS rank FROM me`,
    ...scopeValues,
    uid,
    ...scopeValues,
  );
}
