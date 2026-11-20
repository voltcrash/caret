import type { UiSession } from "@caret/schemas/auth-session";

import { useQuery } from "@tanstack/solid-query";
import { useRouter } from "@tanstack/solid-router";
import { createEffect, onCleanup, onMount } from "solid-js";

import { getAuthClient } from "../../ts/session/client.client";
import { sessionOptions, sessionKey } from "../../ts/session/session";
import {
  getAuthenticatedUser,
  setUserState,
} from "../../ts/session/state.client";
import { OAuthRuntime } from "./oauth-runtime.client";

/** Start observes server authority and invalidates route data. */
export function AuthRuntime() {
  const router = useRouter();
  const session = useQuery(() => sessionOptions());
  let previous: UiSession | null | undefined;
  createEffect(() => {
    if (!session.isSuccess || session.isFetching) return;
    const user = session.data.user;
    const changed =
      previous !== undefined &&
      (previous?.uid !== user?.uid || previous?.email !== user?.email);
    setUserState(user);
    previous = user;
    if (changed) void router.invalidate();
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
