import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { lazy, type JSXElement } from "solid-js";

const Runtime = lazy(
  createClientOnlyFn(async () => import("./browser-runtime.client")),
);

/** The server can render the shell without evaluating browser integrations. */
export function BrowserRuntime(): JSXElement {
  return (
    <ClientOnly>
      <Runtime />
    </ClientOnly>
  );
}
