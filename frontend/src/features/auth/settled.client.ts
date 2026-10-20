import { useQuery } from "@tanstack/solid-query";
import { createEffect, on } from "solid-js";

import { requireApplication } from "../../app/application";
import { sessionOptions } from "./session";
import { accountQueryCache } from "../../app/query-cache.client";

/**
 * True once the app's account owner reflects the server session. Leaves that
 * create actor-scoped collections wait for it, so they never start under the
 * guest scope and get disposed by the sign-in switch moments later.
 */
export function useSessionSettled(): () => boolean {
  const account = requireApplication().accountData;
  const session = useQuery(() => sessionOptions());
  const cache = accountQueryCache();
  const matches = (): boolean =>
    session.isSuccess && account.actor() === (session.data.user?.uid ?? null);
  createEffect(
    on(
      () =>
        matches()
          ? session.data?.user?.registered === true
            ? session.data.user.uid
            : null
          : undefined,
      (actor) => {
        if (actor === undefined) return;
        if (actor === null) void cache.clear();
        else void cache.restore();
      },
    ),
  );
  return () =>
    matches() && (session.data?.user?.registered !== true || cache.ready());
}
