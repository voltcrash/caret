import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { createMemo, lazy, Show, Suspense, type JSXElement } from "solid-js";

import { isServer } from "solid-js/web";

import { isTypingReady } from "../../app/startup";
import { cn } from "../../ts/utils/cn";
import { TypingPlaceholder } from "./placeholder";

const load = createClientOnlyFn(async () => import("./page.client"));
const TypingPage = lazy(load);
// Fetch the engine with the route chunk instead of after hydration. Code only:
// session commands still run when the leaf mounts, never on intent preload.
if (!import.meta.env.SSR) void TypingPage.preload();

/** Document and common shell stay SSR-capable; the engine only mounts in a browser. */
export function TypingLeaf(): JSXElement {
  // Preserve the displayed page during later restarts; only a new mount waits.
  const ready = createMemo((previous) => previous || (!isServer && isTypingReady()), false);
  return (
    <div class="full-width grid h-full min-w-0 grid-cols-1 grid-rows-1">
      <Show when={!ready()}>
        <div class="col-start-1 row-start-1"><TypingPlaceholder /></div>
      </Show>
      <div class={cn("col-start-1 row-start-1 min-w-0", !ready() && "invisible")} inert={!ready()} aria-hidden={!ready()}>
        <ClientOnly>
          <Suspense>
            <TypingPage />
          </Suspense>
        </ClientOnly>
      </div>
    </div>
  );
}
