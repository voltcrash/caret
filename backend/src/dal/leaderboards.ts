import type { Client } from "@caret/schemas/shared";
import type { LeaderboardEntry } from "@caret/schemas/leaderboards";
import { newId } from "../utils/id";
import { statement } from "../db/client";
import { commitBatch } from "../db/commit";
import { getCachedConfiguration } from "../init/configuration";
import { isDevEnvironment, omit } from "../utils/misc";
export type DBLeaderboardEntry = Omit<LeaderboardEntry, "_id"> & {
  _id: string;
};
function board(
  mode: string,
  mode2: string,
  language: string,
  _client: Client = "web",
): string {
  return `${language}_${mode}_${mode2}`;
}
function unpack(row: {
  uid: string;
  rank: number;
  data: string;
}): DBLeaderboardEntry {
  return {
    ...(JSON.parse(row.data) as Omit<LeaderboardEntry, "_id">),
    _id: row.uid,
    rank: row.rank,
  };
}
const snapshot =
  "FROM leaderboard_snapshots s JOIN leaderboard_generations g ON s.board=g.board AND s.generation=g.generation WHERE s.board=?";
export async function get(
  mode: string,
  mode2: string,
  language: string,
  page: number,
  pageSize: number,
  premium = false,
  client: Client = "web",
): Promise<DBLeaderboardEntry[]> {
  if (page < 0 || pageSize < 0) throw new Error("Invalid page or pageSize");
  const rows = await statement(
    `SELECT s.uid,s.rank,s.data::text AS data ${snapshot} ORDER BY s.rank LIMIT ? OFFSET ?`,
    board(mode, mode2, language, client),
    Math.min(pageSize, 1000),
    page * pageSize,
  ).all<{ uid: string; rank: number; data: string }>();
  return rows.results
    .map(unpack)
    .map((entry) => (premium ? entry : omit(entry, ["isPremium"])));
}
export async function getCount(
  mode: string,
  mode2: string,
  language: string,
  client: Client = "web",
): Promise<number> {
  return (
    (await statement(
      // Manually seeded generations may omit the published entry count.
      "SELECT coalesce(g.entries,(SELECT count(*)::integer FROM leaderboard_snapshots s WHERE s.board=g.board AND s.generation=g.generation)) AS count FROM leaderboard_generations g WHERE g.board=?",
      board(mode, mode2, language, client),
    ).first<number>("count")) ?? 0
  );
}
export async function getRank(
  mode: string,
  mode2: string,
  language: string,
  uid: string,
  client: Client = "web",
): Promise<DBLeaderboardEntry | null> {
  const row = await statement(
    `SELECT s.uid,s.rank,s.data::text AS data ${snapshot} AND s.uid=?`,
    board(mode, mode2, language, client),
    uid,
  ).first<{ uid: string; rank: number; data: string }>();
  return row ? unpack(row) : null;
}
export async function update(
  mode: string,
  mode2: string,
  language: string,
  client: Client = "web",
): Promise<{ message: string; rank?: number }> {
  const key = board(mode, mode2, language, client),
    generation = newId();
  const minimum = isDevEnvironment()
    ? 0
    : (await getCachedConfiguration(true)).leaderboards.minTimeTyping;
  // Build + publish within one batch. Readers join one generation, never a partially rebuilt board.
  await commitBatch([
    statement(
      `INSERT INTO leaderboard_snapshots(generation,board,uid,rank,data)
      SELECT ?,?,u.uid,row_number() OVER(ORDER BY b.wpm DESC,b.acc DESC,b.timestamp DESC,u.uid DESC),
      jsonb_merge_patch(b.data,jsonb_build_object('uid',u.uid,'name',u.name,'badgeId',(SELECT value->'id' FROM jsonb_array_elements(coalesce(u.data #> '{inventory,badges}','[]'::jsonb)) WHERE value->>'selected'='true' LIMIT 1),'isPremium',coalesce((u.data #>> '{premium,expirationTimestamp}')::bigint=-1 OR (u.data #>> '{premium,expirationTimestamp}')::bigint>?,false)))
      FROM leaderboard_bests b JOIN users u ON b.uid=u.uid WHERE b.board=? AND b.wpm>0 AND b.acc>0 AND b.timestamp>0 AND u.banned=false AND u.lb_opt_out=false AND u.needs_to_change_name=false AND u.time_typing>?`,
      generation,
      key,
      Date.now(),
      key,
      minimum,
    ),
    statement(
      "INSERT INTO leaderboard_generations(board,generation,updated_at,entries) VALUES(?,?,?,(SELECT count(*)::integer FROM leaderboard_snapshots WHERE board=? AND generation=?)) ON CONFLICT(board) DO UPDATE SET generation=excluded.generation,updated_at=excluded.updated_at,entries=excluded.entries",
      key,
      generation,
      Date.now(),
      key,
      generation,
    ),
    statement("DELETE FROM speed_histograms WHERE board=?", key),
    statement(
      "INSERT INTO speed_histograms(board,bucket,count) SELECT ?,CASE WHEN (data->>'wpm')::double precision>=310 THEN 'Other' ELSE (floor((data->>'wpm')::double precision/10)*10)::integer::text END,count(*)::integer FROM leaderboard_snapshots WHERE board=? AND generation=? GROUP BY 2",
      key,
      key,
      generation,
    ),
    statement(
      "DELETE FROM leaderboard_snapshots WHERE board=? AND generation<>?",
      key,
      generation,
    ),
  ]);
  return { message: "Successfully updated leaderboard" };
}
