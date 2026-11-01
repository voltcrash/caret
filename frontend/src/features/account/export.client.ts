import { operationData } from "../../data/operations";
import { captureAccount } from "../../app/account-scope";
import { normalizeResult } from "../../ts/collections/results/normalize";
import { getTagsOnce } from "../../ts/collections/tags";
import type { SnapshotResult } from "../../ts/constants/default-snapshot";
import type { Mode } from "@caret/schemas/shared";

/** Stable cursor prevents new results from shifting an offset-based export. */
export async function exportAllResults(
  progress: (count: number) => void,
): Promise<SnapshotResult<Mode>[]> {
  const lease = captureAccount();
  const tags = new Set((await getTagsOnce()).map((tag) => tag._id));
  const results: SnapshotResult<Mode>[] = [];
  let cursor: { beforeTimestamp?: number; beforeId?: string } = {};
  for (;;) {
    lease.assertCurrent();
    const page = await operationData("results.get", {
      query: { exportHistory: true, limit: 1000, client: "web", ...cursor },
    });
    lease.assertCurrent();
    results.push(...page.map((result) => normalizeResult(result, tags)));
    progress(results.length);
    const last = page.at(-1);
    if (page.length < 1000 || last === undefined) return results;
    cursor = { beforeTimestamp: last.timestamp, beforeId: last._id };
  }
}
