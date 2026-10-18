import { createFileRoute, notFound } from "@tanstack/solid-router";

export const Route = createFileRoute("/404.html")({
  beforeLoad: () => {
    // oxlint-disable-next-line typescript/only-throw-error -- Router's not-found control signal is intentionally not an Error.
    throw notFound();
  },
});
