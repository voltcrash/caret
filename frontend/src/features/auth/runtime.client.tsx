import { useQuery } from "@tanstack/solid-query";
import { useRouter } from "@tanstack/solid-router";
import { createEffect, onCleanup, onMount } from "solid-js";

import { getAuthClient } from "./client.client";
import { OAuthRuntime } from "./oauth-runtime.client";
import { sessionOptions, sessionKey } from "./session";
import { getAuthenticatedUser, setUserState } from "./state.client";

/** Start observes server authority and invalidates route data; no legacy page pipeline. */
export function AuthRuntime() {
  const router = useRouter();
  const session = useQuery(() => sessionOptions());
  let initialized = false;
  createEffect(() => {
    if (!session.isSuccess || session.isFetching) return;
    const previous = getAuthenticatedUser();
    const user = session.data.user;
    const changed =
      previous?.uid !== user?.uid || previous?.email !== user?.email;
    setUserState(user);
    if (initialized && changed) void router.invalidate();
    initialized = true;
  });
  onMount(() => {
    const unsubscribe = getAuthClient().useSession.subscribe((state) => {
      if (state.isPending || state.isRefetching || state.error !== null) return;
      const current = getAuthenticatedUser();
      if (
        (state.data?.user.id ?? null) === (current?.uid ?? null) &&
        state.data?.user.email === current?.email
      ) {
        return;
      }
      void router.options.context.queryClient.invalidateQueries({
        queryKey: sessionKey,
      });
    });
    onCleanup(unsubscribe);
  });
  return <OAuthRuntime />;
}
