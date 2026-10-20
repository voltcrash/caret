import { operation } from "../../../data/operations";
import { captureAccount } from "../../../app/account-scope";
import { queryKeys } from "./keys";
import { normalizeResult } from "./normalize";
import { Client, Mode } from "@oxytype/schemas/shared";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { BTreeIndex, createCollection } from "@tanstack/solid-db";
import { SnapshotResult } from "../../constants/default-snapshot";
import { getQueryClient } from "../../queries";
import { isAuthenticated } from "../../states/core";
import { getLastResult, setLastResult } from "../../states/snapshot";
import { getTagsOnce } from "../tags";
import { applyIdWorkaround } from "../utils/misc";
import { defineCollection } from "../utils/scope";

function seedLastResult(results: SnapshotResult<Mode>[]): void {
  const latest = results.reduce<SnapshotResult<Mode> | undefined>(
    (acc, result) =>
      acc === undefined || acc.timestamp < result.timestamp ? result : acc,
    undefined,
  );
  if (
    latest !== undefined &&
    (getLastResult()?.timestamp ?? -Infinity) < latest.timestamp
  ) {
    setLastResult(latest);
  }
}

function createResultsCollection(client: Client) {
  const collection = createCollection(
    queryCollectionOptions({
      staleTime: Infinity,
      // Synchronous typing/PB consumers require retained data.
      gcTime: Infinity,
      queryKey: queryKeys.root(client),
      enabled: isAuthenticated,
      queryFn: async () => {
        const lease = captureAccount();
        const [tagIds, response] = await Promise.all([
          getTagsOnce(),
          operation("results.get", { query: { client } }),
        ]);
        lease.assertCurrent();
        const knownTagIds = new Set([...tagIds.map((it) => it._id)]);
        //const options = parseLoadSubsetOptions(ctx.meta?.loadSubsetOptions);

        if (!response.ok) {
          throw new Error(`Error fetching results:${response.message}`);
        }

        const results = response.data
          .map((result) => normalizeResult(result, knownTagIds))
          .map(applyIdWorkaround);

        seedLastResult(results);
        return results;
      },
      queryClient: getQueryClient(),
      getKey: (it) => it._id,
    }),
  );

  collection.createIndex((row) => row.timestamp, {
    indexType: BTreeIndex,
  });

  return collection;
}

export const resultsByClient = {
  web: defineCollection(import.meta.hot, () => createResultsCollection("web")),
};

export const resultsCollection = resultsByClient.web;

export function isResultsReady(): boolean {
  return resultsCollection().isReady();
}

export async function waitForResultsReady(): Promise<void> {
  const lease = captureAccount();
  const collection = resultsCollection();
  await collection.stateWhenReady();
  lease.assertCurrent();
  // Hydrated queries can become ready without executing their query function.
  seedLastResult([...collection.values()]);
}

export function getResults(client: Client = "web"): SnapshotResult<Mode>[] {
  return [...resultsByClient[client]().values()];
}
