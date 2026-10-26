import type { SessionState } from "@caret/schemas/auth-session";

import { currentApplication } from "../../app/application";
import { accountQueryCache } from "../../app/query-cache.client";
import { sessionKey } from "../auth/session";

/** Warm browser history only after the registered actor owns its scope. */
export async function preloadAccount(
  preloadView: () => Promise<unknown>,
): Promise<void> {
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
    preloadView(),
    (async () => {
      await accountQueryCache().restore();
      lease.assertCurrent();
      const results = await import("../../ts/collections/results");
      lease.assertCurrent();
      await results.waitForResultsReady();
    })(),
  ]);
}
