import type { JSXElement } from "solid-js";

import { ClientSchema } from "@oxytype/schemas/shared";
import { createFileRoute } from "@tanstack/solid-router";
import { z } from "zod";

import { urlSearch } from "../app/search";
import { AccountPage } from "../features/account/page";

const SearchSchema = z.object({ client: ClientSchema.optional() }).partial();

export const Route = createFileRoute("/_app/_authenticated/account")({
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
  const navigate = Route.useNavigate();
  return (
    <div class="page pageAccount" id="pageAccount">
      <AccountPage
        client={search().client ?? "web"}
        onClient={(client) =>
          void navigate({
            search: (previous) => ({ ...previous, client }),
            replace: true,
            resetScroll: false,
          })
        }
      />
    </div>
  );
}
