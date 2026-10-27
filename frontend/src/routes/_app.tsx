import { createFileRoute, Outlet, useMatches } from "@tanstack/solid-router";
import { Show } from "solid-js";

import { AppLayout } from "../app/layout";
import { HomeOverview } from "../features/discover/home";

export const Route = createFileRoute("/_app")({
  component: Layout,
});

function Layout() {
  const typing = useMatches({
    select: (matches) => matches.some((match) => match.routeId === "/_app/"),
  });
  return (
    <>
      <AppLayout>
        <Outlet />
      </AppLayout>
      <Show when={typing()}>
        <HomeOverview />
      </Show>
    </>
  );
}
