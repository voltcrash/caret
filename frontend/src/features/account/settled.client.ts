import { useQuery } from "@tanstack/solid-query";
import { createMemo } from "solid-js";

import { createAppSignal } from "../../app/state";
import { useSessionSettled } from "../auth/settled.client";
import { sessionOptions } from "../auth/session";

/** Registered actor whose initial account load (snapshot, collections, server preferences) finished. */
const [getLoadedAccount, setLoadedAccount] = createAppSignal<string | null>(
  null,
);
export { setLoadedAccount };

/**
 * Undefined until the session and, for a registered actor, its initial
 * account load settle; then whether a registered account is signed in.
 * Session refetches that keep the same actor do not change the value.
 */
export function useAccountSettled(): () => boolean | undefined {
  const session = useQuery(() => sessionOptions());
  const settled = useSessionSettled();
  return createMemo(() => {
    if (!settled()) return undefined;
    const user = session.data?.user;
    if (user?.registered !== true) return false;
    return getLoadedAccount() === user.uid ? true : undefined;
  });
}
