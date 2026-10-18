import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { lazy, Suspense, type JSXElement } from "solid-js";

const load = createClientOnlyFn(async () => import("./page.client"));
const TypingPage = lazy(load);
// Fetch the engine with the route chunk instead of after hydration. Code only:
// session commands still run when the leaf mounts, never on intent preload.
if (!import.meta.env.SSR) void TypingPage.preload();

/** Document and common shell stay SSR-capable; the engine only mounts in a browser. */
export function TypingLeaf(): JSXElement {
  const loading = () => <p role="status">Loading typing test…</p>;
  return (
    <ClientOnly fallback={loading()}>
      <Suspense fallback={loading()}>
        <TypingPage />
      </Suspense>
    </ClientOnly>
  );
}
