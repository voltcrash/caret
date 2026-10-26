import type { JSXElement } from "solid-js";

import { ClientSchema } from "@caret/schemas/shared";
import { createFileRoute } from "@tanstack/solid-router";
import { z } from "zod";

import { urlSearch } from "../app/search";
import { AccountPage, preloadAccount } from "../features/account/page";

const SearchSchema = z.object({ client: ClientSchema.optional() }).partial();

export const Route = createFileRoute("/_app/_authenticated/account")({
  loader: () => {
    if (!import.meta.env.SSR) void preloadAccount().catch(() => undefined);
  },
  validateSearch: (search: Record<string, unknown>) =>
    urlSearch(SearchSchema)(search),
  head: () => ({
    meta: [
      { title: "Account | Oxytype" },
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
