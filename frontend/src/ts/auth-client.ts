import { captureAccount } from "../app/account-scope";
import { onCleanup } from "solid-js";
import { createAppOwned } from "../app/application";
import type { SessionState } from "@oxytype/schemas/auth-session";
import { sessionKey } from "../features/auth/session";
import { getQueryClient } from "./queries";

import { getAuthClient } from "../features/auth/client.client";
export { getAuthClient };
import type { AuthUser } from "./auth-types";
export type { AuthUser, SocialProvider } from "./auth-types";
import {
  getAuthenticatedUser,
  setUserState,
} from "../features/auth/state.client";
export { getAuthenticatedUser, setUserState };

const authState = createAppOwned(() => {
  const state = { revision: 0, available: false };
  onCleanup(() => {
    state.revision++;
  });
  return state;
});

import { checkAuthResult } from "../features/auth/result";
export { checkAuthResult };

/** Reads the Better Auth session and linked providers into the user state. */
export async function refreshSession(): Promise<AuthUser | null> {
  const state = authState();
  const revision = ++state.revision;
  const lease = captureAccount();
  const assertCurrent = (): void => {
    lease.assertCurrent();
    if (state.revision !== revision) {
      throw new DOMException("Session changed", "AbortError");
    }
  };
  const session = checkAuthResult(
    await getAuthClient().getSession({
      fetchOptions: { signal: lease.signal },
    }),
  );
  assertCurrent();
  let user: AuthUser | null = null;
  if (session) {
    const accounts = checkAuthResult(
      await getAuthClient().listAccounts({
        fetchOptions: { signal: lease.signal },
      }),
    );
    user = {
      uid: session.user.id,
      email: session.user.email,
      displayName: session.user.name,
      providerData: (accounts ?? [])
        .filter((account) => ["google", "github"].includes(account.providerId))
        .map((account) => ({
          providerId: account.providerId,
          email: session.user.email,
        })),
    };
  }
  assertCurrent();
  setUserState(user);
  return user;
}

export function isAuthAvailable(): boolean {
  return authState().available;
}
/** The session owner reports availability once the session query settles. */
export function setAuthAvailable(available: boolean): void {
  authState().available = available;
}
export async function signOut(): Promise<void> {
  const state = authState();
  state.revision++;
  const lease = captureAccount();
  checkAuthResult(
    await getAuthClient().signOut({ fetchOptions: { signal: lease.signal } }),
  );
  if (!lease.isCurrent()) return;
  const client = getQueryClient();
  await client.cancelQueries({ queryKey: sessionKey });
  if (!lease.isCurrent()) return;
  // The session owner must see the guest state before account data is disposed.
  client.setQueryData<SessionState>(sessionKey, (session) =>
    session === undefined ? session : { ...session, user: null },
  );
  setUserState(null);
}
export async function updateProfile(name: string): Promise<void> {
  checkAuthResult(await getAuthClient().updateUser({ name }));
  await refreshSession();
}
export async function deleteUnfinishedUser(): Promise<void> {
  checkAuthResult(
    await getAuthClient().$fetch("/cancel-sign-up", { method: "POST" }),
  );
}

export { requestOAuth } from "../features/auth/popup.client";
