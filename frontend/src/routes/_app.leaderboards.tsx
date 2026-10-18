import type { JSXElement } from "solid-js";

import { createFileRoute } from "@tanstack/solid-router";

import { publicEnv } from "../app/public-env";
import { stringifySearch, urlSearch } from "../app/search";
import { leaderboardOptions } from "../data/leaderboards";
import { prefetch } from "../data/prefetch";
import { LeaderboardPage } from "../features/leaderboards/page";
import {
  applyUrlParams,
  defaultSelection,
  LeaderboardUrlParamsSchema,
  type LeaderboardUrlParams,
  type LeaderboardView,
  urlParams,
} from "../features/leaderboards/selection";

const viewOf = (search: LeaderboardUrlParams): LeaderboardView =>
  applyUrlParams(defaultSelection, search);

export const Route = createFileRoute("/_app/leaderboards")({
  validateSearch: (search: Record<string, unknown>) =>
    urlSearch(LeaderboardUrlParamsSchema)(search),
  loaderDeps: ({ search }) => {
    const view = viewOf(search);
    return { selection: view.selection, page: view.page };
  },
  // Public first page only; private rank loads separately in the browser.
  loader: async ({ context, deps }) => {
    if (import.meta.env.OXYTYPE_OFFLINE) return;
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
  head: () => ({
    links: [{ rel: "canonical", href: `${publicEnv.origin}/leaderboards` }],
    meta: [
      { title: "Leaderboards | Oxytype" },
      { property: "og:title", content: "Leaderboards | Oxytype" },
      {
        name: "description",
        content: "All-time, daily and weekly XP Oxytype leaderboards.",
      },
    ],
  }),
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
