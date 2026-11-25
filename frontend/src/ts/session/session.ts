import type { SessionState } from "@caret/schemas/auth-session";
import {
  queryOptions,
  type UndefinedInitialDataOptions,
} from "@tanstack/solid-query";
import { getSessionState } from "../../functions/session";
export const sessionKey = ["auth", "session"] as const;
export const sessionOptions = (): ReturnType<
  UndefinedInitialDataOptions<
    SessionState,
    Error,
    SessionState,
    typeof sessionKey
  >
> => {
  return queryOptions({
    queryKey: sessionKey,
    queryFn: async ({ signal }) =>
      import.meta.env.CARET_OFFLINE
        ? { user: null, signUpEnabled: false }
        : await getSessionState({ signal }),
    staleTime: 30_000,
    // A tab returning from another app/tab must observe revocation immediately.
    refetchOnWindowFocus: "always",
    retry: false,
    meta: { ssrSafe: true },
  });
};
export { authRedirect } from "./redirect";
