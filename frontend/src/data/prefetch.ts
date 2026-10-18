import type { QueryClient, QueryKey } from "@tanstack/solid-query";
import { isServer } from "solid-js/web";

type Prefetchable = {
  queryKey: QueryKey;
  queryFn?: unknown;
  staleTime?: unknown;
};

/**
 * Route loaders coordinate Query: fresh data is reused,
 * failures render inline. A failed SSR read is dropped so the browser retries
 * it instead of hydrating an error.
 */
export async function prefetch(
  client: QueryClient,
  ...options: Prefetchable[]
): Promise<void> {
  await Promise.all(
    options.map(async (option) => {
      try {
        await client.query(option as Parameters<QueryClient["query"]>[0]);
      } catch {
        if (isServer) {
          client.removeQueries({ queryKey: option.queryKey, exact: true });
        }
      }
    }),
  );
}

/**
 * Solid Query throws query errors during SSR. Server renders read only what
 * the loader cached; the browser observes, refetches and reports failures.
 */
export function onlyCachedOnServer(enabled = true): boolean {
  return enabled && !isServer;
}
