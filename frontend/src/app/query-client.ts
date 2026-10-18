import { QueryClient, type QueryObserverOptions } from "@tanstack/solid-query";

/** Called once per router/app: request-local on the server, app-local in the browser. */
export function createQueryClient(
  queries: Pick<QueryObserverOptions, "staleTime" | "retry"> = {
    staleTime: 60_000,
    retry: false,
  },
): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries,
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          query.meta?.["ssrSafe"] === true && query.state.status === "success",
      },
    },
  });
}
