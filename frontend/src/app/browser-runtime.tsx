import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { lazy, Suspense, type JSXElement } from "solid-js";

const Runtime = lazy(
  createClientOnlyFn(async () => import("./browser-runtime.client")),
);

/** The server can render the shell without evaluating browser integrations. */
export function BrowserRuntime(): JSXElement {
  return (
    <ClientOnly>
      <Suspense fallback={null}>
        <Runtime />
      </Suspense>
    </ClientOnly>
  );
}
