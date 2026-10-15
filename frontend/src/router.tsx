import { createRouter } from "@tanstack/solid-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/solid-router-ssr-query";
import { createIsomorphicFn } from "@tanstack/solid-start";

import { createQueryClient } from "./app/query-client";
import { AppError } from "./components/app-error";
import { routeTree } from "./routeTree.gen";
import { requestNonce } from "./server/nonce.server";

const getNonce = createIsomorphicFn()
  .server(() => requestNonce())
  .client(() => undefined);

export function getRouter() {
  const queryClient = createQueryClient();
  const router = createRouter({
    ssr: { nonce: getNonce() },
    defaultErrorComponent: AppError,
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    scrollRestoration: true,
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
