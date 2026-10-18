import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { lazy, Suspense, type JSXElement } from "solid-js";

import { H2 } from "../../ts/components/common/Headers";

const Search = lazy(
  createClientOnlyFn(async () => ({
    default: (await import("./search.client")).ProfileSearch,
  })),
);

export function ProfileSearchPage(): JSXElement {
  const shell = (
    <div class="grid min-h-full place-items-center">
      <H2 class="text-2xl" text="Profile lookup" />
    </div>
  );
  return (
    <ClientOnly fallback={shell}>
      <Suspense fallback={shell}>
        <Search />
      </Suspense>
    </ClientOnly>
  );
}
