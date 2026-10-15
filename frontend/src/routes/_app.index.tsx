import { createFileRoute, Link } from "@tanstack/solid-router";

export const Route = createFileRoute("/_app/")({
  component: () => (
    <section class="grid gap-4">
      <h1 class="text-3xl">oxytype</h1>
      <p>A minimalistic, customizable typing test.</p>
      <Link to="/about">About Oxytype</Link>
    </section>
  ),
});
