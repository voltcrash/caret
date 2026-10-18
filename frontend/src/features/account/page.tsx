import type { Client } from "@oxytype/schemas/shared";

import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { lazy, Suspense, type JSXElement } from "solid-js";

const View = lazy(
  createClientOnlyFn(async () => ({
    default: (await import("./content.client")).AccountView,
  })),
);

/** Private account page: the server renders only a shell, never results. */
export function AccountPage(props: { client: Client }): JSXElement {
  const shell = <div class="grid h-150 place-items-center"></div>;
  return (
    <ClientOnly fallback={shell}>
      <Suspense fallback={shell}>
        <View client={props.client} />
      </Suspense>
    </ClientOnly>
  );
}
