import { createAuthClient } from "better-auth/client";
import { deviceAuthorizationClient } from "better-auth/client/plugins";
import { dashClient } from "@better-auth/infra/client";
import { envConfig } from "virtual:env-config";
import { createSignal } from "solid-js";
import { promiseWithResolvers } from "./utils/misc";
import { setUserId } from "./states/core";
import { googleSignUpEvent } from "./events/google-sign-up";
import { createEvent } from "./hooks/createEvent";
import { fetchUserFromApi } from "./ape/user";
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
let authClient: OxytypeAuthClient | undefined;
/** Built on first browser use, never while the module is evaluated. */
export function getAuthClient(): OxytypeAuthClient {
  authClient ??= createOxytypeAuthClient();
  return authClient;
}
import type { AuthUser, SocialProvider } from "./auth-types";
export type { AuthUser, SocialProvider } from "./auth-types";
const [getAuthenticatedUser, setAuthenticatedUser] =
  createSignal<AuthUser | null>(null);
export { getAuthenticatedUser };
let available = false;
let ignoreAuthCallback = false;
type ReadyCallback = (success: boolean, user: AuthUser | null) => Promise<void>;
let readyCallback: ReadyCallback | undefined;
const { promise: authPromise, resolve: resolveAuthPromise } =
  promiseWithResolvers();
export { authPromise };

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
    !ignoreAuthCallback &&
    (previous?.uid !== user?.uid || previous?.email !== user?.email)
  ) {
    setUserState(user);
    await readyCallback?.(true, user);
  }
  return user;
}

export async function init(callback: ReadyCallback): Promise<void> {
  readyCallback = callback;
  try {
    if (envConfig.devOffline) {
      available = false;
      setUserState(null);
      // Match asynchronous network initialization so the app can mount listeners.
      await Promise.resolve();
      await callback(true, null);
      return;
    }
    available = true;
    const user = await refreshSession(false);
    if (user !== null) {
      // A social sign-in can return before the username/captcha onboarding is complete.
      try {
        // Share the onboarding check with snapshot/config initialization.
        await fetchUserFromApi(user.uid);
      } catch (error) {
        if (
          !(error instanceof SnapshotInitError) ||
          error.responseCode !== 404
        ) {
          throw error;
        }
        ignoreAuthCallback = true;
        googleSignUpEvent.dispatch({ signedInUser: { user }, isNewUser: true });
        return;
      }
    }
    setUserState(user);
    await callback(true, user);
  } catch (error) {
    available = false;
    console.error("Better Auth failed to initialize", error);
    setUserState(null);
    await callback(false, null);
  } finally {
    resolveAuthPromise();
  }
}
export function isAuthAvailable(): boolean {
  return available;
}
export async function signOut(): Promise<void> {
  checkAuthResult(await getAuthClient().signOut());
  setUserState(null);
  ignoreAuthCallback = false;
  await readyCallback?.(true, null);
}
export function resetIgnoreAuthCallback(): void {
  ignoreAuthCallback = false;
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
  ignoreAuthCallback = true;
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
      ignoreAuthCallback = false;
      setUserState(user);
      await readyCallback?.(true, user);
    } else {
      throw new Error("Failed to load account");
    }
  } catch (error) {
    ignoreAuthCallback = false;
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
      ignoreAuthCallback ||
      syncing ||
      !available
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
