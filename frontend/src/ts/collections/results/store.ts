import { queryKeys } from "./keys";
import { normalizeResult } from "./normalize";
import { Client, Mode } from "@oxytype/schemas/shared";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { BTreeIndex, createCollection } from "@tanstack/solid-db";
import { bindResultsReady } from "../../states/results-ready";
import Ape from "../../ape";
import { SnapshotResult } from "../../constants/default-snapshot";
import { getQueryClient } from "../../queries";
import { isAuthenticated } from "../../states/core";
import { getLastResult, setLastResult } from "../../states/snapshot";
import { getTagsOnce } from "../tags";
import { applyIdWorkaround } from "../utils/misc";
import { defineCollection } from "../utils/scope";

function createResultsCollection(client: Client) {
  const collection = createCollection(
    queryCollectionOptions({
      staleTime: Infinity,
      // Web's synchronous typing/PB consumers still require retained data.
      // Terminal history can refetch after five minutes without subscribers.
      gcTime: client === "web" ? Infinity : 5 * 60 * 1000,
      queryKey: queryKeys.root(client),
      enabled: isAuthenticated,
      queryFn: async () => {
        const tagIds = await getTagsOnce();
        const knownTagIds = new Set([...tagIds.map((it) => it._id)]);
        //const options = parseLoadSubsetOptions(ctx.meta?.loadSubsetOptions);

        const response = await Ape.results.get({
          query: { client },
        });

        if (response.status !== 200) {
          throw new Error(`Error fetching results:${response.body.message}`);
        }

        const results = response.body.data
          .map((result) => normalizeResult(result, knownTagIds))
          .map(applyIdWorkaround);

        if (
          client === "web" &&
          getLastResult() === undefined &&
          results.length > 0
        ) {
          const lastResult = results.reduce((acc, cur) =>
            acc === undefined || acc.timestamp < cur.timestamp ? cur : acc,
          );
          setLastResult(lastResult);
        }
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
  tui: defineCollection(import.meta.hot, () => createResultsCollection("tui")),
};

export const resultsCollection = resultsByClient.web;

export function isResultsReady(): boolean {
  return resultsCollection().isReady();
}

bindResultsReady(isResultsReady);

export async function waitForResultsReady(): Promise<void> {
  await resultsCollection().stateWhenReady();
}

export function getResults(client: Client = "web"): SnapshotResult<Mode>[] {
  return [...resultsByClient[client]().values()];
}
