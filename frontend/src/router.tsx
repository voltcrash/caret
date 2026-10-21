import { createRouter } from "@tanstack/solid-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/solid-router-ssr-query";
import { createIsomorphicFn } from "@tanstack/solid-start";

import { preloadStartup } from "./app/preload.client";
import { createQueryClient } from "./app/query-client";
import { parseSearch, stringifySearch } from "./app/search";
import { AppError } from "./components/app-error";
import { RoutePending } from "./components/route-pending";
import { routeTree } from "./routeTree.gen";
import { requestNonce } from "./server/nonce.server";

const getNonce = createIsomorphicFn()
  .server(() => requestNonce())
  .client(() => undefined);

const preload = createIsomorphicFn()
  .server(() => undefined)
  .client(() => {
    void preloadStartup(window.location.pathname).catch((error: unknown) =>
      console.error("Startup preload failed", error),
    );
  });

export function getRouter() {
  preload();
  const queryClient = createQueryClient();
  const router = createRouter({
    ssr: { nonce: getNonce() },
    defaultErrorComponent: AppError,
    defaultPendingComponent: RoutePending,
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    // Query decides freshness for every intent preload and navigation.
    defaultPreloadStaleTime: 0,
    // Unknown URLs are a 404 page, never a parent route's missing-item view.
    notFoundMode: "root",
    parseSearch,
    stringifySearch,
    scrollRestoration: true,
    scrollToTopSelectors: ['[data-scroll-restoration-id="page-content"]'],
  });
  setupRouterSsrQueryIntegration({ router, queryClient });
  return router;
}

declare module "@tanstack/solid-router" {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Router registration uses declaration merging.
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
