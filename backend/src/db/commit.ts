import type { QueryResult as PgQueryResult } from "pg";
import { queryTypes, type PreparedQuery, type QueryResult } from "./query";
import { statement } from "./client";
import { runtime } from "../runtime/env";
import {
  postgresError,
  isTransientDatabaseError,
  retryIdempotentWrite,
} from "./retry";
import { newId } from "../utils/id";

/** Receipt and effects commit together; replay never applies an increment twice. */
export async function commitBatch(
  queries: PreparedQuery[],
): Promise<QueryResult[] | undefined> {
  const receipt = newId();
  const batch = [
    statement(
      "INSERT INTO write_receipts(id,created_at) VALUES(?,?)",
      receipt,
      Date.now(),
    ),
    ...queries,
  ];
  return await retryIdempotentWrite(async () => {
    try {
      const sql = runtime().sql;
      const results = await sql.transaction(async (client) => {
        const results: PgQueryResult[] = [];
        for (const query of batch) {
          results.push(
            await client.query({
              text: query.sql,
              values: query.values,
              types: queryTypes,
            }),
          );
        }
        return results;
      });
      return results.slice(1).map((result) => ({
        results: result.rows,
        rowCount: result.rowCount ?? 0,
      }));
    } catch (error) {
      const pg = postgresError(error);
      const duplicateReceipt =
        pg?.code === "23505" && pg.constraint === "write_receipts_pkey";
      if (!duplicateReceipt && !isTransientDatabaseError(error)) throw error;
      const committed = await retryIdempotentWrite(
        async () =>
          await statement(
            "SELECT id FROM write_receipts WHERE id=?",
            receipt,
          ).first(),
      );
      if (committed === null) throw error;
      return undefined;
    }
  });
}
