import { createFileRoute, Link, Outlet } from "@tanstack/solid-router";

export const Route = createFileRoute("/_app")({ component: Layout });
function Layout() {
  return (
    <div class="mx-auto grid min-h-dvh max-w-6xl grid-rows-[auto_1fr_auto] gap-12 p-8">
      <header>
        <nav aria-label="Main navigation" class="flex gap-8">
          <Link to="/" class="text-main">
            oxytype
          </Link>
          <Link to="/about">about</Link>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <footer class="text-sub">Oxytype contributors · GPL-3.0</footer>
    </div>
  );
}
