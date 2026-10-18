import { useQuery } from "@tanstack/solid-query";

import { requireApplication } from "../../app/application";
import { sessionOptions } from "./session";

/**
 * True once the app's account owner reflects the server session. Leaves that
 * create actor-scoped collections wait for it, so they never start under the
 * guest scope and get disposed by the sign-in switch moments later.
 */
export function useSessionSettled(): () => boolean {
  const account = requireApplication().accountData;
  const session = useQuery(() => sessionOptions());
  return () =>
    session.isSuccess && account.actor() === (session.data.user?.uid ?? null);
}
