import type { SessionState } from "@oxytype/schemas/auth-session";
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
      import.meta.env.OXYTYPE_OFFLINE
        ? { user: null, signUpEnabled: false }
        : await getSessionState({ signal }),
    staleTime: 0,
    retry: false,
  });
};
/** Only local URLs can receive an auth redirect; preserve search/hash. */
export function authRedirect(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  ) {
    return "/";
  }
  return value;
}
