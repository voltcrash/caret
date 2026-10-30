import type { JSXElement } from "solid-js";

import { ClientSchema } from "@caret/schemas/shared";
import type { UserProfile } from "@caret/schemas/users";
import { createFileRoute, notFound } from "@tanstack/solid-router";
import { isServer } from "solid-js/web";
import { z } from "zod";

import { urlSearch } from "../app/search";
import { pageHead } from "../app/seo";
import { isUserNotFound, profileOptions } from "../data/profile";
import { ProfileMissing } from "../features/profile/missing";
import {
  ProfilePage,
  profileFrame,
  preloadProfile,
} from "../features/profile/page";
import { ProfileSkeleton } from "../features/profile/skeleton";

const SearchSchema = z.object({ client: ClientSchema.optional() }).partial();

/** Index profiles with authored text or a personal best visible in the SSR summary. */
function hasProfileContent(profile: UserProfile): boolean {
  return (
    profile.banned !== true &&
    (Boolean(profile.details?.bio?.trim()) ||
      ["15", "60"].some(
        (duration) => (profile.personalBests.time[duration]?.length ?? 0) > 0,
      ))
  );
}

export const Route = createFileRoute("/_app/profile/$uidOrName")({
  validateSearch: (search: Record<string, unknown>) =>
    urlSearch(SearchSchema)(search),
  loaderDeps: ({ search }) => ({ client: search.client ?? "web" }),
  loader: async ({ context, params, deps }) => {
    const options = profileOptions(params.uidOrName, deps.client);
    if (!isServer) {
      void preloadProfile().catch(() => undefined);
      const cached = context.queryClient.getQueryData(options.queryKey);
      if (cached !== undefined) {
        void context.queryClient.query(options).catch(() => undefined);
        return { indexable: hasProfileContent(cached) };
      }
    }
    try {
      const profile = await context.queryClient.query(options);
      return { indexable: hasProfileContent(profile) };
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
      return { indexable: false };
    }
  },
  head: ({ params, loaderData }) =>
    pageHead(
      `${params.uidOrName} | Caret`,
      `${params.uidOrName}'s Caret profile and personal bests.`,
      `/profile/${encodeURIComponent(params.uidOrName)}`,
      loaderData?.indexable === true,
    ),
  notFoundComponent: Missing,
  pendingComponent: Pending,
  component: Profile,
});

function Pending(): JSXElement {
  return (
    <div class="page pageProfile" id="pageProfile">
      <div class={profileFrame}>
        <ProfileSkeleton />
      </div>
    </div>
  );
}

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
  return (
    <div class="page pageProfile" id="pageProfile">
      <ProfilePage
        uidOrName={params().uidOrName}
        client={search().client ?? "web"}
      />
    </div>
  );
}
