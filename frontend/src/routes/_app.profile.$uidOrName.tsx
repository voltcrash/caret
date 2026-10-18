import type { JSXElement } from "solid-js";

import { ClientSchema } from "@oxytype/schemas/shared";
import { createFileRoute, notFound } from "@tanstack/solid-router";
import { isServer } from "solid-js/web";
import { z } from "zod";

import { publicEnv } from "../app/public-env";
import { urlSearch } from "../app/search";
import { isUserNotFound, profileOptions } from "../data/profile";
import { ProfileMissing } from "../features/profile/missing";
import { ProfilePage } from "../features/profile/page";

const SearchSchema = z.object({ client: ClientSchema.optional() }).partial();

export const Route = createFileRoute("/_app/profile/$uidOrName")({
  validateSearch: (search: Record<string, unknown>) =>
    urlSearch(SearchSchema)(search),
  loaderDeps: ({ search }) => ({ client: search.client ?? "web" }),
  loader: async ({ context, params, deps }) => {
    const options = profileOptions(params.uidOrName, deps.client);
    try {
      await context.queryClient.query(options);
    } catch (error) {
      if (isUserNotFound(error)) {
        // oxlint-disable-next-line typescript/only-throw-error -- Router's not-found control signal.
        throw notFound();
      }
      // Hydrate no failed read; the browser retries and renders errors inline.
      // Retrying here would run the same service/policies twice during SSR.
      if (isServer) {
        context.queryClient.removeQueries({
          queryKey: options.queryKey,
          exact: true,
        });
      }
    }
  },
  head: ({ params }) => {
    const title = `${params.uidOrName} | Oxytype`;
    const url = `${publicEnv.origin}/profile/${encodeURIComponent(params.uidOrName)}`;
    return {
      links: [{ rel: "canonical", href: url }],
      meta: [
        { title },
        { property: "og:title", content: title },
        { property: "og:url", content: url },
        {
          name: "description",
          content: `${params.uidOrName}'s Oxytype profile and personal bests.`,
        },
      ],
    };
  },
  notFoundComponent: Missing,
  component: Profile,
});

function Missing(): JSXElement {
  const params = Route.useParams();
  return (
    <div class="page pageProfile" id="pageProfile">
      <ProfileMissing name={params().uidOrName} />
    </div>
  );
}

function Profile(): JSXElement {
  const params = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <div class="page pageProfile" id="pageProfile">
      <ProfilePage
        uidOrName={params().uidOrName}
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
