import { createFileRoute } from "@tanstack/solid-router";

import { pageHead } from "../app/seo";
import { ProfileSearchPage } from "../features/profile/search";

export const Route = createFileRoute("/_app/profile/")({
  head: () =>
    pageHead(
      "Profile Search | Caret",
      "Find a Caret user's public typing profile.",
      "/profile",
      false,
    ),
  component: () => (
    <div class="page pageProfileSearch" id="pageProfileSearch">
      <ProfileSearchPage />
    </div>
  ),
});
