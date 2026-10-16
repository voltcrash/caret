import { createFileRoute, Outlet } from "@tanstack/solid-router";

import { requireSession } from "../features/auth/guard";

/** Private layout: registered accounts only; never cached HTML. */
export const Route = createFileRoute("/_app/_authenticated")({
  beforeLoad: async ({ context, location }) => ({
    user: await requireSession(context.queryClient, location.href),
  }),
  component: Outlet,
});
