import type { JSXElement } from "solid-js";

import { useQuery } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";

import { publicEnv } from "../app/public-env";
import { urlSearch } from "../app/search";
import { onlyCachedOnServer } from "../data/prefetch";
import { sessionOptions } from "../features/auth/session";
import { SettingsPage } from "../features/settings/page";
import {
  sectionForTab,
  SettingsUrlParamsSchema,
} from "../features/settings/tabs";

export const Route = createFileRoute("/_app/settings")({
  staticData: { fixedHeader: true },
  validateSearch: (search: Record<string, unknown>) =>
    urlSearch(SettingsUrlParamsSchema)(search),
  head: () => ({
    links: [{ rel: "canonical", href: `${publicEnv.origin}/settings` }],
    meta: [
      { title: "Settings | Oxytype" },
      { property: "og:title", content: "Settings | Oxytype" },
    ],
  }),
  component: Settings,
});

function Settings(): JSXElement {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  // Account sections need a registered session; private operations still
  // authorize on the server.
  const session = useQuery(() => ({
    ...sessionOptions(),
    enabled: onlyCachedOnServer(),
  }));
  const registered = (): boolean => session.data?.user?.registered === true;
  return (
    <div class="page pageSettings" id="pageSettings">
      <SettingsPage
        section={sectionForTab(search().tab, registered()) ?? "behavior"}
        highlight={search().highlight}
        onSection={(tab) =>
          void navigate({ search: { tab }, replace: true, resetScroll: false })
        }
      />
    </div>
  );
}
