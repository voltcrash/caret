import type { QueryClient } from "@tanstack/solid-query";
import type { UiSession } from "@caret/schemas/auth-session";
import { getAuthClient } from "./client.client";
import { setUserState } from "./state.client";
import { checkAuthResult } from "./result";
import { requestOAuth } from "./popup.client";
import { sessionOptions, sessionKey } from "./session";
import { completeSignUp } from "../../functions/signup";
import { createAppOwned } from "../../app/application";
const authOperation = createAppOwned(() => ({ busy: false }));
function exclusive<A extends unknown[], T>(
  action: (...args: A) => Promise<T>,
): (...args: A) => Promise<T> {
  return async (...args) => {
    const state = authOperation();
    if (state.busy)
      throw new Error("Another authentication request is in progress");
    state.busy = true;
    try {
      return await action(...args);
    } finally {
      state.busy = false;
    }
  };
}

type Provider = "google" | "github";
export type AuthActions = {
  refresh: () => Promise<UiSession | null>;
  login: (provider: Provider) => Promise<void>;
  logout: () => Promise<void>;
  reauthenticate: (provider: Provider) => Promise<void>;
  complete: (name: string, captcha: string) => Promise<void>;
  cancel: () => Promise<void>;
  link: (provider: Provider) => Promise<void>;
  unlink: (provider: Provider) => Promise<void>;
};
/** Component-owned actions share Start's canonical session query. */
export const createAuthActions = (
  queryClient: QueryClient,
  invalidateRoutes: () => Promise<unknown>,
): AuthActions => {
  const refresh = async (): Promise<UiSession | null> => {
    await queryClient.cancelQueries({ queryKey: sessionKey });
    const state = await queryClient.query({
      ...sessionOptions(),
      staleTime: 0,
    });
    setUserState(state.user);
    await invalidateRoutes();
    return state.user;
  };
  const logout = async (): Promise<void> => {
    checkAuthResult(await getAuthClient().signOut());
    await refresh();
  };
  const login = async (provider: "google" | "github"): Promise<void> => {
    await requestOAuth(provider);
    await refresh();
  };
  const reauthenticate = async (
    provider: "google" | "github",
  ): Promise<void> => {
    const original = (await queryClient.query(sessionOptions())).user;
    if (original === null) throw new Error("User is not signed in");
    await requestOAuth(provider);
    const current = await refresh();
    if (current?.uid !== original.uid) {
      await logout();
      throw new Error("Reauthenticate with the same account");
    }
  };
  return {
    refresh: exclusive(refresh),
    logout: exclusive(logout),
    login: exclusive(login),
    reauthenticate: exclusive(reauthenticate),
    complete: exclusive(
      async (name: string, captcha: string): Promise<void> => {
        try {
          await completeSignUp({ data: { name, captcha } });
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes("Account already registered")
          ) {
            await refresh();
            return;
          }
          throw error;
        }
        checkAuthResult(await getAuthClient().updateUser({ name }));
        await refresh();
      },
    ),
    cancel: exclusive(async (): Promise<void> => {
      checkAuthResult(
        await getAuthClient().$fetch("/cancel-sign-up", { method: "POST" }),
      );
      await logout();
    }),
    link: exclusive(async (provider: "google" | "github"): Promise<void> => {
      await requestOAuth(provider, true);
      await refresh();
    }),
    unlink: exclusive(async (provider: "google" | "github"): Promise<void> => {
      const user = (await queryClient.query(sessionOptions())).user;
      const other = user?.providerData.find(
        ({ providerId }) => providerId !== provider,
      )?.providerId;
      if (other === undefined) {
        throw new Error("Keep at least one authentication method");
      }
      await reauthenticate(other);
      const accounts = checkAuthResult(await getAuthClient().listAccounts());
      const account = accounts?.find(
        ({ providerId }) => providerId === provider,
      );
      if (account === undefined) {
        throw new Error("Authentication method not found");
      }
      checkAuthResult(
        await getAuthClient().unlinkAccount({ accountId: account.id }),
      );
      await refresh();
    }),
  };
};
