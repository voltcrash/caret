import { typedKeys } from "@oxytype/util/objects";
import { tryCatch } from "@oxytype/util/trycatch";

import { captureAccount } from "../app/account-scope";
import { createAppMemo } from "../app/application";
import {
  getAuthClient,
  checkAuthResult,
  refreshSession,
  requestOAuth,
  type AuthUser as User,
  type AuthUser as UserType,
  type SocialProvider,
  signOut as authSignOut,
  getAuthenticatedUser,
  isAuthAvailable,
  signInWithPopup,
} from "./auth-client";
import { updateFromServer as updateConfigFromServer } from "./config/remote";
import * as DB from "./db";
import { authEvent } from "./events/auth";
import * as Sentry from "./sentry";
import { setUserId } from "./states/core";
import { hideLoaderBar, showLoaderBar } from "./states/loader-bar";
import {
  showErrorNotification,
  showNoticeNotification,
  showSuccessNotification,
} from "./states/notifications";
import { FaObject } from "./types/font-awesome";
import { createErrorMessage } from "./utils/error";
import { SnapshotInitError } from "./utils/snapshot-init-error";

type AuthMethodInfo = {
  display: string;
  fa: FaObject;
  provider: SocialProvider;
};

/**
 * auth methods, keep order from most to least preferred.
 * This is used for reauthenticate
 */
const authMethods = {
  github: {
    display: "GitHub",
    provider: "github",
    fa: { variant: "brand", icon: "fa-github" },
  },
  google: {
    display: "Google",
    provider: "google",
    fa: { variant: "brand", icon: "fa-google" },
  },
} as const satisfies Record<string, AuthMethodInfo>;

export type AuthMethod = keyof typeof authMethods;

export type AuthResult =
  | {
      success: true;
    }
  | {
      success: false;
      message: string;
    };

type ReauthSuccess = {
  status: "success";
  message: string;
  user: User;
};

type ReauthFailed = {
  status: "error" | "notice";
  message: string;
};

type ReauthenticateOptions = {
  excludeMethod?: AuthMethod;
};

const authenticationMemos = Object.fromEntries(
  typedKeys(authMethods).map((authMethod) => {
    const memo = createAppMemo(() => {
      const providerId = getProviderId(authMethod);

      const user = getAuthenticatedUser();
      if (user === null) return undefined;
      const provider = user.providerData.find(
        (p) => p.providerId === providerId,
      );
      const result = {
        isInUse: provider !== undefined,
        email: provider?.email ?? undefined,
        hasAdditionalAuthMethods: hasAdditionalAuthMethods(authMethod),
      };

      return result;
    });
    return [authMethod, memo];
  }),
);

/**
 * `unauthenticated`: the server rejected the session. `unavailable`: the data
 * could not be loaded (offline, timeout, server error); the session stands.
 */
export type AccountLoad = "loaded" | "unauthenticated" | "unavailable";

function isAuthenticationFailure(error: unknown): boolean {
  if (error instanceof SnapshotInitError) {
    return error.responseCode === 401 || error.responseCode === 403;
  }
  return (
    error instanceof Error &&
    error.message.startsWith(
      "Snapshot didn't initialize due to lacking authentication",
    )
  );
}

async function getDataAndInit(): Promise<AccountLoad> {
  const lease = captureAccount();
  try {
    console.log("getting account data");
    // collections sync on their own; waiting keeps tags and presets inside the account loading gate
    const accountReady = Promise.all([
      DB.initSnapshot(),
      import("./collections/presets").then(async (m) => {
        lease.assertCurrent();
        return m.waitForPresetsReady();
      }),
      import("./collections/tags").then(async (m) => {
        lease.assertCurrent();
        return m.waitForTagsReady();
      }),
      import("./collections/custom-themes").then((m) => {
        lease.assertCurrent();
        m.startCustomThemesSync();
        return undefined;
      }),
      import("./collections/results").then((m) => {
        lease.assertCurrent();
        void m.refetchResults().catch((error: unknown) => {
          if (lease.isCurrent()) console.error(error);
        });
        return undefined;
      }),
    ]).then(([snapshot]) => {
      if (snapshot === false) {
        throw new Error(
          "Snapshot didn't initialize due to lacking authentication even though user is authenticated",
        );
      }
      return snapshot;
    });
    const [snapshot] = await Promise.all([
      accountReady,
      updateConfigFromServer(accountReady),
    ]);

    lease.assertCurrent();
    void Sentry.setUser(snapshot.uid, snapshot.name);

    return "loaded";
  } catch (error) {
    if (!lease.isCurrent()) return "unavailable";
    console.error(error);
    if (error instanceof SnapshotInitError) {
      if (error.responseCode === 429) {
        showNoticeNotification(
          "Doing so will save you bandwidth, make the next test be ready faster and will not sign you out (which could mean your new personal best would not save to your account).",
          {
            durationMs: 0,
          },
        );
        showNoticeNotification(
          "You will run into this error if you refresh the website to restart the test. It is NOT recommended to do that. Instead, use tab + enter or just tab (with quick tab mode enabled) to restart the test.",
          {
            durationMs: 0,
          },
        );
      }

      showErrorNotification(`Failed to get user data: ${error.message}`);
    } else {
      showErrorNotification("Failed to get user data", { error });
    }
    return isAuthenticationFailure(error) ? "unauthenticated" : "unavailable";
  }
}

/**
 * Only a server rejection ends the session. A network loss, timeout or server
 * error while loading (e.g. reconnecting after an offline start) keeps it, so
 * the caller can retry instead of revoking a valid sign-in.
 */
export async function loadUser(_user: UserType): Promise<AccountLoad> {
  const lease = captureAccount();
  const result = await getDataAndInit();
  if (!lease.isCurrent()) return result;
  if (result === "unauthenticated") {
    signOut();
    return result;
  }
  if (result === "loaded") {
    authEvent.dispatch({ type: "snapshotUpdated", data: { isInitial: true } });
  }
  return result;
}

export async function onAuthStateChanged(
  authInitialisedAndConnected: boolean,
  user: UserType | null,
): Promise<void> {
  console.debug(`account controller ready`);

  let userPromise: Promise<void> = Promise.resolve();

  if (authInitialisedAndConnected) {
    console.debug(`auth state changed, user ${user ? "true" : "false"}`);
    if (user) {
      setUserId(user.uid);
      userPromise = loadUser(user).then(() => undefined);
    } else {
      setUserId(null);
      DB.setSnapshot(undefined);
    }
  }

  if (!authInitialisedAndConnected || !user) {
    void Sentry.clearUser();
  }

  authEvent.dispatch({
    type: "authStateChanged",
    data: { isUserSignedIn: user !== null, loadPromise: userPromise },
  });
}

export async function signInWithProvider(
  authMethod: AuthMethod,
  options: { rememberMe: boolean },
): Promise<AuthResult> {
  if (!isAuthAvailable()) {
    return { success: false, message: "Authentication uninitialized" };
  }

  const provider = getAuthProvider(authMethod);
  const { error } = await tryCatch(
    signInWithPopup(provider, options.rememberMe),
  );

  if (error !== null) {
    return { success: false, message: error.message };
  }
  return { success: true };
}

export async function addAuthProvider(options: {
  authMethod: AuthMethod;
}): Promise<void> {
  if (!isAuthAvailable()) {
    showErrorNotification("Authentication uninitialized", { durationMs: 3000 });
    return;
  }
  if (!getAuthenticatedUser()) return;
  const providerName = getAuthMethodDisplay(options.authMethod);
  showLoaderBar();
  try {
    await requestOAuth(getAuthProvider(options.authMethod), true);
    await refreshSession(false);
    authEvent.dispatch({ type: "authConfigUpdated" });
    showSuccessNotification(`${providerName} authentication added`);
  } catch (error) {
    showErrorNotification(`Failed to add ${providerName} authentication`, {
      error,
    });
  } finally {
    hideLoaderBar();
  }
}

export async function removeAuthProvider(
  authMethod: AuthMethod,
): Promise<ReauthSuccess | ReauthFailed> {
  const reauth = await reauthenticate({
    excludeMethod: authMethod,
  });
  if (reauth.status !== "success") {
    return {
      status: reauth.status,
      message: reauth.message,
    };
  }
  try {
    const accounts = checkAuthResult(await getAuthClient().listAccounts());
    const account = accounts?.find((entry) => entry.providerId === authMethod);
    if (!account) throw new Error("Authentication method not found");
    checkAuthResult(
      await getAuthClient().unlinkAccount({ accountId: account.id }),
    );
    await refreshSession(false);
  } catch (e) {
    const message = createErrorMessage(
      e,
      `Failed to unlink ${getAuthMethodDisplay(authMethod)} account`,
    );
    return {
      status: "error",
      message,
    };
  }
  return {
    status: "success",
    message: `${getAuthMethodDisplay(authMethod)} authentication removed`,
    user: reauth.user,
  };
}

export function signOut(): void {
  if (!isAuthAvailable()) {
    showErrorNotification("Authentication uninitialized", { durationMs: 3000 });
    return;
  }
  if (getAuthenticatedUser() === null) return;
  void authSignOut();
}

function getAuthProvider(authMethod: AuthMethod): SocialProvider {
  return authMethods[authMethod].provider;
}

export async function reauthenticate(
  options: ReauthenticateOptions = {},
): Promise<ReauthSuccess | ReauthFailed> {
  if (!isAuthAvailable()) {
    return {
      status: "error",
      message: "Authentication is not initialized",
    };
  }

  const user = getAuthenticatedUser();
  if (user === null) {
    return {
      status: "error",
      message: "User is not signed in",
    };
  }

  const authMethod = getPreferredAuthenticationMethod(options.excludeMethod);

  try {
    if (authMethod === undefined) {
      return {
        status: "error",
        message:
          "Failed to reauthenticate: there is no valid authentication present on the account.",
      };
    }

    await requestOAuth(authMethod);
    const refreshed = await refreshSession(false);
    if (refreshed?.uid !== user.uid) {
      await authSignOut();
      throw new Error("Reauthenticate with the same account");
    }

    return {
      status: "success",
      message: "Reauthenticated",
      user,
    };
  } catch (e) {
    return {
      status: "error",
      message: createErrorMessage(e, "Failed to reauthenticate"),
    };
  }
}

function getPreferredAuthenticationMethod(
  exclude?: AuthMethod,
): AuthMethod | undefined {
  const filteredMethods = typedKeys(authMethods).filter((it) => it !== exclude);
  for (const method of filteredMethods) {
    if (isUsingAuthentication(method)) return method;
  }
  return undefined;
}

function isUsingAuthentication(authMethod: AuthMethod): boolean {
  const providerId = getProviderId(authMethod);
  return (
    getAuthenticatedUser()?.providerData.some(
      (p) => p.providerId === providerId,
    ) ?? false
  );
}

export function isUsingAuthenticationReactive(authMethod: AuthMethod): boolean {
  return authenticationMemos[authMethod]?.()?.isInUse ?? false;
}

export function hasAdditionalAuthMethods(authMethod: AuthMethod) {
  return typedKeys(authMethods).some(
    (it) => it !== authMethod && isUsingAuthentication(it),
  );
}

export function getAuthMethodEmailReactive(
  authMethod: AuthMethod,
): string | undefined {
  return authenticationMemos[authMethod]?.()?.email;
}

export function hasAdditionalAuthMethodsReactive(authMethod: AuthMethod) {
  return authenticationMemos[authMethod]?.()?.hasAdditionalAuthMethods ?? false;
}

export function getAuthMethodDisplay(authMethod: AuthMethod): string {
  return authMethods[authMethod].display;
}

export function getAuthMethodIcon(authMethod: AuthMethod): FaObject {
  return authMethods[authMethod].fa;
}

function getProviderId(authMethod: AuthMethod): SocialProvider {
  return authMethods[authMethod].provider;
}
