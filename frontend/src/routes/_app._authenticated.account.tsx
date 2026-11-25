import type { Client } from "@caret/schemas/shared";
import type { JSXElement } from "solid-js";

import { createFileRoute } from "@tanstack/solid-router";

import { AccountPage } from "../features/account/page";

function parseClientSearch(search: Record<string, unknown>): {
  client?: Client;
} {
  return { client: search["client"] === "web" ? "web" : undefined };
}

export const Route = createFileRoute("/_app/_authenticated/account")({
  loader: () => {
    if (!import.meta.env.SSR) {
      void import("../features/account/page")
        .then(async (m) => m.preloadAccount())
        .catch(() => undefined);
    }
  },
  validateSearch: parseClientSearch,
  head: () => ({
    meta: [
      { title: "Account | Caret" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Account,
});

function Account(): JSXElement {
  const search = Route.useSearch();
  return (
    <div class="page pageAccount" id="pageAccount">
      <AccountPage client={search().client ?? "web"} />
    </div>
  );
}
