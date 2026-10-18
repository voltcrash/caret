import type { QueryClient } from "@tanstack/solid-query";
import type { UiSession } from "@oxytype/schemas/auth-session";
import { getAuthClient } from "./client.client";
import { setUserState } from "./state.client";
import { checkAuthResult } from "./result";
import { requestOAuth } from "./popup.client";
import { sessionOptions, sessionKey } from "./session";
import { completeSignUp } from "../../functions/signup";

type Provider = "google" | "github";
export type AuthActions = {
  refresh: () => Promise<UiSession | null>;
  login: (provider: Provider, rememberMe?: boolean) => Promise<void>;
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
    const state = await queryClient.query(sessionOptions());
    setUserState(state.user);
    await invalidateRoutes();
    return state.user;
  };
  const logout = async (): Promise<void> => {
    checkAuthResult(await getAuthClient().signOut());
    await refresh();
  };
  const login = async (
    provider: "google" | "github",
    rememberMe = true,
  ): Promise<void> => {
    await requestOAuth(provider, false, rememberMe);
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
    refresh,
    logout,
    login,
    reauthenticate,
    complete: async (name: string, captcha: string): Promise<void> => {
      await completeSignUp({ data: { name, captcha } });
      checkAuthResult(await getAuthClient().updateUser({ name }));
      await refresh();
    },
    cancel: async (): Promise<void> => {
      checkAuthResult(
        await getAuthClient().$fetch("/cancel-sign-up", { method: "POST" }),
      );
      await logout();
    },
    link: async (provider: "google" | "github"): Promise<void> => {
      await requestOAuth(provider, true);
      await refresh();
    },
    unlink: async (provider: "google" | "github"): Promise<void> => {
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
    },
  };
};
