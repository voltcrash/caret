import { getAuth } from "../init/auth";
import MonkeyError from "./error";

export type AuthenticatedSession = {
  uid: string;
  email: string;
  createdAt: Date;
};

export type SessionLookup = {
  /** Skip the encrypted cookie cache and read the session row. */
  fresh?: boolean;
  /** Receives refreshed session/cache cookies; omitted callers drop them. */
  setCookie?: (cookie: string) => void;
};

/**
 * By default an encrypted session cookie cache (≤ `SESSION_COOKIE_CACHE_SECONDS`
 * old) stands in for the PostgreSQL lookup, so revocation or disablement can take
 * that long to apply. Bearer tokens always read PostgreSQL.
 */
export async function verifySession(
  headers: Headers,
  lookup: SessionLookup = { fresh: true },
): Promise<AuthenticatedSession> {
  const { headers: responseHeaders, response: result } =
    await getAuth().api.getSession({
      headers,
      query: { disableCookieCache: lookup.fresh === true },
      returnHeaders: true,
    });
  for (const cookie of responseHeaders.getSetCookie()) {
    lookup.setCookie?.(cookie);
  }
  if (result === null) {
    throw new MonkeyError(
      401,
      "Session expired or revoked - please login again",
    );
  }
  if ("disabled" in result.user && result.user.disabled === true) {
    throw new MonkeyError(403, "Account disabled");
  }
  return {
    uid: result.user.id,
    email: result.user.email,
    createdAt: result.session.createdAt,
  };
}

export async function deleteUser(uid: string): Promise<void> {
  await (await getAuth().$context).internalAdapter.deleteUser(uid);
}

export async function revokeTokensByUid(uid: string): Promise<void> {
  await (await getAuth().$context).internalAdapter.deleteUserSessions(uid);
}
