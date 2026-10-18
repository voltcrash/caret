import { createFileRoute } from "@tanstack/solid-router";

import { publicEnv } from "../app/public-env";
import { ProfileSearchPage } from "../features/profile/search";

export const Route = createFileRoute("/_app/profile/")({
  head: () => ({
    links: [{ rel: "canonical", href: `${publicEnv.origin}/profile` }],
    meta: [{ title: "Profile Search | Oxytype" }],
  }),
  component: () => (
    <div class="page pageProfileSearch" id="pageProfileSearch">
      <ProfileSearchPage />
    </div>
  ),
});
