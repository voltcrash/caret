import { QueryClient } from "@tanstack/solid-query";

/** Called once per router: request-local on the server, app-local in the browser. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, retry: false },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          query.meta?.["ssrSafe"] === true && query.state.status === "success",
      },
    },
  });
}
