import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";
import { dashClient } from "@better-auth/infra/client";
import { envConfig } from "virtual:env-config";
import { createSignal } from "solid-js";
import { createAppOwned } from "../app/application";
import { authReadiness } from "../app/readiness";
import { appSignal } from "../app/state";
import { setUserId } from "./states/core";
import { googleSignUpEvent } from "./events/google-sign-up";
import { createEvent } from "./hooks/createEvent";
import { SnapshotInitError } from "./utils/snapshot-init-error";

function createOxytypeAuthClient() {
  const authURL = new URL(
    `${envConfig.backendUrl.replace(/\/$/, "")}/auth`,
    window.location.origin,
  );
  return createAuthClient({
    baseURL: authURL.href,
    basePath: authURL.pathname,
    fetchOptions: {
      credentials: "include",
      ...(envConfig.devOffline
        ? {
            customFetchImpl: async () =>
              Response.json(
                {
                  message:
                    "Authentication is unavailable in frontend-only development",
                },
                { status: 503 },
              ),
          }
        : {}),
    },
    plugins: [dashClient(), deviceAuthorizationClient()],
  });
}
type OxytypeAuthClient = ReturnType<typeof createOxytypeAuthClient>;
const authClient = createAppOwned(createOxytypeAuthClient);
/** Built on first browser use, never while the module is evaluated. */
export function getAuthClient(): OxytypeAuthClient {
  return authClient();
}
import type { AuthUser, SocialProvider } from "./auth-types";
export type { AuthUser, SocialProvider } from "./auth-types";
const [getAuthenticatedUser, setAuthenticatedUser] = appSignal(() =>
  createSignal<AuthUser | null>(null),
);
export { getAuthenticatedUser };

type ReadyCallback = (success: boolean, user: AuthUser | null) => Promise<void>;
const authState = createAppOwned(() => ({
  available: false,
  ignoreAuthCallback: false,
  readyCallback: undefined as ReadyCallback | undefined,
}));

export function checkAuthResult<T>(result: {
  data: T;
  error: { message?: string } | null;
}): T {
  if (result.error !== null) {
    throw new Error(result.error.message ?? "Authentication failed");
  }
  return result.data;
}

export function setUserState(user: AuthUser | null): void {
  setAuthenticatedUser(user);
  setUserId(user?.uid ?? null);
}

export async function refreshSession(notify = true): Promise<AuthUser | null> {
  const previous = getAuthenticatedUser();
  const session = checkAuthResult(await getAuthClient().getSession());
  let user: AuthUser | null = null;
  if (session) {
    const accounts = checkAuthResult(await getAuthClient().listAccounts());
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
  setAuthenticatedUser(user);
  if (
    notify &&
    !authState().ignoreAuthCallback &&
    (previous?.uid !== user?.uid || previous?.email !== user?.email)
  ) {
    setUserState(user);
    await authState().readyCallback?.(true, user);
  }
  return user;
}

export async function init(
  callback: ReadyCallback,
  checkAccount = true,
): Promise<void> {
  return authReadiness().start(async () => {
    authState().readyCallback = callback;
    try {
      if (envConfig.devOffline) {
        authState().available = false;
        setUserState(null);
        // Match asynchronous network initialization so the app can mount listeners.
        await Promise.resolve();
        await callback(true, null);
        return;
      }
      authState().available = true;
      const user = await refreshSession(false);
      if (user !== null && checkAccount) {
        // A social sign-in can return before the username/captcha onboarding is complete.
        try {
          // Share the onboarding check with snapshot/config initialization.
          const { fetchUserFromApi } = await import("./ape/user");
          await fetchUserFromApi(user.uid);
        } catch (error) {
          if (
            !(error instanceof SnapshotInitError) ||
            error.responseCode !== 404
          ) {
            throw error;
          }
          authState().ignoreAuthCallback = true;
          googleSignUpEvent.dispatch({
            signedInUser: { user },
            isNewUser: true,
          });
          return;
        }
      }
      setUserState(user);
      await callback(true, user);
    } catch (error) {
      authState().available = false;
      console.error("Better Auth failed to initialize", error);
      setUserState(null);
      await callback(false, null);
    }
  });
}
export function isAuthAvailable(): boolean {
  return authState().available;
}
export async function signOut(): Promise<void> {
  checkAuthResult(await getAuthClient().signOut());
  setUserState(null);
  authState().ignoreAuthCallback = false;
  await authState().readyCallback?.(true, null);
}
export function resetIgnoreAuthCallback(): void {
  authState().ignoreAuthCallback = false;
}
export async function updateProfile(name: string): Promise<void> {
  checkAuthResult(await getAuthClient().updateUser({ name }));
  await refreshSession(false);
}
export async function deleteUnfinishedUser(): Promise<void> {
  checkAuthResult(
    await getAuthClient().$fetch("/cancel-sign-up", { method: "POST" }),
  );
}

type OAuthRequest = {
  provider: SocialProvider;
  link: boolean;
  rememberMe: boolean;
  resolve: () => void;
  reject: (error: Error) => void;
};
export const oauthRequestEvent = createEvent<OAuthRequest>();
export async function requestOAuth(
  provider: SocialProvider,
  link = false,
  rememberMe = true,
): Promise<void> {
  if (envConfig.devOffline) {
    throw new Error(
      "Authentication is unavailable in frontend-only development",
    );
  }
  return new Promise((resolve, reject) =>
    oauthRequestEvent.dispatch({ provider, link, rememberMe, resolve, reject }),
  );
}
export async function signInWithPopup(
  provider: SocialProvider,
  rememberMe: boolean,
): Promise<void> {
  authState().ignoreAuthCallback = true;
  try {
    await requestOAuth(provider, false, rememberMe);
    const user = await refreshSession(false);
    if (!user) throw new Error("Sign in did not create a session");
    const response = await fetch(`${envConfig.backendUrl}/users`, {
      credentials: "include",
      headers: { "X-Client-Version": envConfig.clientVersion },
    });
    if (response.status === 404) {
      googleSignUpEvent.dispatch({ signedInUser: { user }, isNewUser: true });
    } else if (response.ok) {
      authState().ignoreAuthCallback = false;
      setUserState(user);
      await authState().readyCallback?.(true, user);
    } else {
      throw new Error("Failed to load account");
    }
  } catch (error) {
    authState().ignoreAuthCallback = false;
    throw error;
  }
}

/** Better Auth refreshes and broadcasts sessions while a component owns this subscription. */
export function observeAuthSession(): () => void {
  if (envConfig.devOffline) return () => undefined;
  let syncing = false;
  return getAuthClient().useSession.subscribe((state) => {
    if (
      state.isPending ||
      state.isRefetching ||
      state.error !== null ||
      authState().ignoreAuthCallback ||
      syncing ||
      !authState().available
    ) {
      return;
    }
    const current = getAuthenticatedUser();
    if (
      (state.data?.user.id ?? null) === (current?.uid ?? null) &&
      state.data?.user.email === current?.email
    ) {
      return;
    }
    syncing = true;
    void refreshSession()
      .catch((error: unknown) => console.error("Session refresh failed", error))
      .finally(() => {
        syncing = false;
      });
  });
}
