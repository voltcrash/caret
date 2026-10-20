import { createFileRoute, Outlet, useLocation } from "@tanstack/solid-router";
import { type JSXElement, Show } from "solid-js";

import { RoutePending } from "../components/route-pending";
import { AccountSkeleton } from "../features/account/skeleton";
import { requireSession } from "../features/auth/guard";

/** Private layout: registered accounts only; never cached HTML. */
export const Route = createFileRoute("/_app/_authenticated")({
  beforeLoad: async ({ context, location }) => ({
    user: await requireSession(context.queryClient, location.href),
  }),
  pendingComponent: Pending,
  component: Outlet,
});

/** A slow session check already shows the account page's skeleton. */
function Pending(): JSXElement {
  const location = useLocation();
  return (
    <Show when={location().pathname === "/account"} fallback={<RoutePending />}>
      <div class="page pageAccount" id="pageAccount">
        <AccountSkeleton />
      </div>
    </Show>
  );
}
