import type { SessionState } from "@oxytype/schemas/auth-session";
import type { Client } from "@oxytype/schemas/shared";

import { ClientOnly } from "@tanstack/solid-router";
import { createClientOnlyFn } from "@tanstack/solid-start";
import { lazy, Suspense, type JSXElement } from "solid-js";

import { currentApplication } from "../../app/application";
import { sessionKey } from "../auth/session";
import { AccountSkeleton } from "./skeleton";

const View = lazy(
  createClientOnlyFn(async () => ({
    default: (await import("./content.client")).AccountView,
  })),
);

/** Intent/idle warmup; never construct collections under the guest scope. */
export const preloadAccount = createClientOnlyFn(async (): Promise<void> => {
  const app = currentApplication();
  const user = app?.queryClient.getQueryData<SessionState>(sessionKey)?.user;
  if (
    app === undefined ||
    user?.registered !== true ||
    app.accountData.actor() !== user.uid
  ) {
    return;
  }
  const lease = app.accountData.capture();
  await Promise.all([
    View.preload(),
    import("../../app/query-cache.client").then(async (cache) => {
      lease.assertCurrent();
      await cache.accountQueryCache().restore();
      lease.assertCurrent();
      const results = await import("../../ts/collections/results");
      lease.assertCurrent();
      await results.waitForResultsReady();
      return undefined;
    }),
  ]);
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
