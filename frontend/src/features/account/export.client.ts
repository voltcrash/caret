import { operationData } from "../../data/operations";
import { captureAccount } from "../../app/account-scope";
import { normalizeResult } from "../../ts/collections/results/normalize";
import { getTagsOnce } from "../../ts/collections/tags";
import type { SnapshotResult } from "../../ts/constants/default-snapshot";
import type { Mode } from "@caret/schemas/shared";
import { OperationError } from "../../data/operation-result";

/** Stable cursor prevents new results from shifting an offset-based export. */
export async function exportAllResults(
  progress: (count: number) => void,
): Promise<SnapshotResult<Mode>[]> {
  const lease = captureAccount();
  const tags = new Set((await getTagsOnce()).map((tag) => tag._id));
  const results: SnapshotResult<Mode>[] = [];
  let cursor: { beforeTimestamp?: number; beforeId?: string } = {};
  let limited = 0;
  for (;;) {
    lease.assertCurrent();
    const page = await operationData("results.get", {
      query: { exportHistory: true, limit: 1000, client: "web", ...cursor },
    }).catch(async (error: unknown) => {
      if (
        !(error instanceof OperationError) ||
        error.status !== 429 ||
        limited++ >= 3
      ) {
        throw error;
      }
      await new Promise<void>((resolve, reject) => {
        const abort = (): void => {
          clearTimeout(timer);
          reject(lease.signal.reason);
        };
        const timer = setTimeout(() => {
          lease.signal.removeEventListener("abort", abort);
          resolve();
        }, 60_000);
        lease.signal.addEventListener("abort", abort, { once: true });
        if (lease.signal.aborted) abort();
      });
      return undefined;
    });
    if (page === undefined) continue;
    limited = 0;
    lease.assertCurrent();
    results.push(...page.map((result) => normalizeResult(result, tags)));
    progress(results.length);
    const last = page.at(-1);
    if (page.length < 1000 || last === undefined) return results;
    cursor = { beforeTimestamp: last.timestamp, beforeId: last._id };
  }
}
