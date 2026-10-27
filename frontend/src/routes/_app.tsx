import { createFileRoute, Outlet } from "@tanstack/solid-router";

import { AppLayout } from "../app/layout";

export const Route = createFileRoute("/_app")({
  component: Layout,
});

function Layout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
