import type { Client } from "@oxytype/schemas/shared";

import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { lazy, Suspense, type JSXElement } from "solid-js";

import { AccountSkeleton } from "./skeleton";

const View = lazy(
  createClientOnlyFn(async () => ({
    default: (await import("./content.client")).AccountView,
  })),
);

/** Intent/idle warmup; never construct collections under the guest scope. */
export const preloadAccount = createClientOnlyFn(async (): Promise<void> => {
  const warmup = await import("./preload.client");
  await warmup.preloadAccount(View.preload);
});

/** Private account page: the server renders only a skeleton, never results. */
export function AccountPage(props: { client: Client }): JSXElement {
  return (
    <ClientOnly fallback={<AccountSkeleton />}>
      <Suspense fallback={<AccountSkeleton />}>
        <View client={props.client} />
      </Suspense>
    </ClientOnly>
  );
}
