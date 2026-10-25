import type { D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import { binding, statement } from "./client";
import {
  d1ErrorMessage,
  isTransientD1Error,
  retryIdempotentD1Write,
} from "./retry";
import { newId } from "../utils/id";

/**
 * Replay one prepared atomic batch, never its application callbacks.
 * Resolves each query's result, or undefined when a lost acknowledgement was
 * recovered through the receipt (the results are then unavailable).
 */
export async function commitBatch(
  queries: D1PreparedStatement[],
): Promise<D1Result[] | undefined> {
  const receipt = newId();
  const batch = [
    statement(
      "INSERT INTO write_receipts(id,created_at) VALUES(?,?)",
      receipt,
      Date.now(),
    ),
    ...queries,
  ];
  return await retryIdempotentD1Write(async () => {
    try {
      return (await binding().batch(batch)).slice(1);
    } catch (error) {
      const duplicateReceipt = d1ErrorMessage(error).includes(
        "UNIQUE constraint failed: write_receipts.id",
      );
      if (!duplicateReceipt && !isTransientD1Error(error)) throw error;
      // A write forces primary routing and advances this session's bookmark.
      // Repeating this no-op is safe, even if its acknowledgement is lost.
      const committed = await retryIdempotentD1Write(
        async () =>
          await statement(
            "UPDATE write_receipts SET created_at=created_at WHERE id=? RETURNING id",
            receipt,
          ).first<{ id: string }>(),
      );
      if (committed === null) throw error;
      // Receipt and all effects commit together, or neither does. A duplicate
      // receipt aborts the entire replay before increments can execute twice.
      return undefined;
    }
  });
}
