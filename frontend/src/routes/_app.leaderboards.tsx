import type { JSXElement } from "solid-js";

import { createFileRoute } from "@tanstack/solid-router";

import { stringifySearch } from "../app/search-codec";
import { pageHead } from "../app/seo";
import { prefetch } from "../data/prefetch";
import { LeaderboardPage } from "../features/leaderboards/page";
import {
  applyUrlParams,
  defaultSelection,
  parseLeaderboardSearch,
  type LeaderboardUrlParams,
  type LeaderboardView,
  urlParams,
} from "../features/leaderboards/search";

const viewOf = (search: LeaderboardUrlParams): LeaderboardView =>
  applyUrlParams(defaultSelection, search);

export const Route = createFileRoute("/_app/leaderboards")({
  validateSearch: parseLeaderboardSearch,
  loaderDeps: ({ search }) => {
    const view = viewOf(search);
    return { selection: view.selection, page: view.page };
  },
  // Public first page only; private rank loads separately in the browser.
  loader: async ({ context, deps }) => {
    if (import.meta.env.CARET_OFFLINE) return;
    const { leaderboardOptions } =
      await import("../features/leaderboards/queries");
    await prefetch(
      context.queryClient,
      leaderboardOptions(deps.selection, deps.page),
    );
  },
  // Daily and weekly boards refresh when the page is opened again.
  onLeave: ({ context }) => {
    void context.queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === "public" &&
        query.queryKey[1] === "leaderboard" &&
        ["weekly", "daily"].includes(query.queryKey[2] as string),
    });
  },
  head: () =>
    pageHead(
      "Leaderboards | Caret",
      "Explore Caret typing leaderboards: compare all-time typing speed results and daily and weekly XP rankings.",
      "/leaderboards",
    ),
  component: Leaderboards,
});

function Leaderboards(): JSXElement {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const view = (): LeaderboardView => viewOf(search());
  const searchFor = (next: LeaderboardView): LeaderboardUrlParams => ({
    ...urlParams(next.selection, next.page),
    goToUserPage: next.goToUserPage ? true : undefined,
  });
  return (
    <div class="page pageLeaderboards" id="pageLeaderboards">
      <LeaderboardPage
        view={view()}
        explicit={search().type !== undefined}
        normalized={
          stringifySearch({ ...search(), goToUserPage: undefined }) ===
          stringifySearch({ ...searchFor(view()), goToUserPage: undefined })
        }
        onChange={(next) =>
          void navigate({
            search: searchFor(next),
            replace: true,
            resetScroll: false,
          })
        }
      />
    </div>
  );
}
