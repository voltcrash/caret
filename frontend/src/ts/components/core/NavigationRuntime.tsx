import {
  useBeforeLeave,
  useCurrentMatches,
  useIsRouting,
  useLocation,
  useNavigate,
  useParams,
} from "@solidjs/router";
import { batch, createEffect, createSignal, on, onCleanup } from "solid-js";

import { isAuthAvailable } from "../../auth-client";
import * as PageController from "../../controllers/page-controller";
import { authEvent } from "../../events/auth";
import { canNavigate } from "../../navigation/guard";
import {
  bindNavigation,
  navigate,
  NavigateOptions,
} from "../../navigation/navigation";
import { AppRouteInfo } from "../../navigation/routes";
import { setAppLoading } from "../../states/app";
import { isAuthenticated } from "../../states/core";
import { showErrorNotification } from "../../states/notifications";
import * as PageTransition from "../../states/page-transition";

type NavigationRequest = {
  options: NavigateOptions;
  resolve: () => void;
  reject: (reason: unknown) => void;
};

export function NavigationRuntime(): null {
  const location = useLocation();
  const solidNavigate = useNavigate();
  const matches = useCurrentMatches();
  const params = useParams();
  const isRouting = useIsRouting();
  const [revision, setRevision] = createSignal(0);
  let ready = false;
  let replacingUrl = false;
  let pending: NavigationRequest | undefined;
  let navigatingOptions: NavigateOptions | undefined;
  let transitions = 0;
  let pageChanges = Promise.resolve();
  const inFlight = new Set<NavigationRequest>();
  const urlReplacements = new Set<() => void>();
  let disposed = false;

  const currentUrl = () => location.pathname + location.search + location.hash;
  const path = (url: string): string => {
    const target = new URL(url || "/", window.location.origin);
    if (target.origin !== window.location.origin) {
      throw new Error("App navigation requires a same-origin URL");
    }
    return (
      (target.pathname.replace(/\/$/, "") || "/") + target.search + target.hash
    );
  };

  const allowed = (options: NavigateOptions): boolean => {
    if (
      !options.force &&
      (isRouting() || transitions > 0 || PageTransition.get())
    ) {
      return false;
    }
    return canNavigate(options);
  };
  const routeTo = (
    target: string,
    options: NavigateOptions,
    replace = false,
  ): void => {
    navigatingOptions = options;
    try {
      solidNavigate(target, {
        resolve: false,
        replace,
        scroll: false,
        state: replace || target === currentUrl() ? location.state : undefined,
      });
    } finally {
      navigatingOptions = undefined;
    }
  };

  useBeforeLeave((event) => {
    if (replacingUrl) return;
    if (!allowed(navigatingOptions ?? {})) {
      event.preventDefault();
      if (navigatingOptions !== undefined) {
        pending?.resolve();
        pending = undefined;
      }
    }
  });

  onCleanup(
    bindNavigation({
      navigate: async (url, options) => {
        if (!allowed(options)) return;
        const target = path(url ?? currentUrl());
        await new Promise<void>((resolve, reject) => {
          batch(() => {
            pending?.resolve();
            pending = { options, resolve, reject };
            ready = true;
            // Auth refreshes may normalize a trailing slash; keep the current history entry.
            routeTo(target, options, url === undefined);
            // Same-URL auth refreshes still run the page lifecycle.
            setRevision((value) => value + 1);
          });
        });
      },
      replaceUrl: async (url) => {
        const target = path(url);
        await new Promise<void>((resolve) => {
          batch(() => {
            urlReplacements.add(resolve);
            replacingUrl = true;
            try {
              solidNavigate(target, {
                resolve: false,
                replace: true,
                scroll: false,
                state: location.state,
              });
              setRevision((value) => value + 1);
            } finally {
              replacingUrl = false;
            }
          });
        });
      },
    }),
  );

  createEffect(
    on([currentUrl, isRouting, revision], () => {
      if (isRouting()) return;
      const urlOnly = urlReplacements.size > 0;
      for (const resolve of urlReplacements) resolve();
      urlReplacements.clear();
      // Filter/deep-link updates preserve the current page and its local state.
      if (!ready || (urlOnly && pending === undefined)) return;
      const match = matches().at(-1);
      if (match === undefined) return;
      const {
        page,
        access,
        redirect: routeRedirect,
      } = match.route.info as AppRouteInfo;
      const request = pending;
      const options = request?.options ?? {};

      const redirect =
        access === undefined
          ? undefined
          : !isAuthAvailable()
            ? "/"
            : access === "user" && !isAuthenticated()
              ? "/login"
              : access === "guest" && isAuthenticated()
                ? "/account"
                : undefined;
      if (redirect !== undefined) {
        routeTo(redirect, options, true);
        return;
      }

      if (routeRedirect !== undefined) {
        const target = new URL(routeRedirect, window.location.origin);
        new URLSearchParams(location.search).forEach((value, key) => {
          target.searchParams.set(key, value);
        });
        target.hash = location.hash;
        routeTo(target.pathname + target.search + target.hash, options, true);
        return;
      }

      pending = undefined;
      const changeOptions = {
        ...options,
        ...(page === "profile"
          ? { force: true, params: { uidOrName: params["uidOrName"] ?? "" } }
          : page === "404"
            ? { force: true }
            : {}),
      };
      if (request !== undefined) inFlight.add(request);
      transitions++;
      // Forced auth refreshes wait for any outgoing page animation/loading.
      const previousChange = pageChanges;
      pageChanges = (async () => {
        await previousChange;
        try {
          if (!disposed) await PageController.change(page, changeOptions);
          request?.resolve();
        } catch (error) {
          if (request !== undefined) {
            request.reject(error);
          } else if (!disposed) {
            showErrorNotification("Failed to navigate", { error });
          }
        } finally {
          transitions--;
          if (request !== undefined) inFlight.delete(request);
        }
      })();
    }),
  );

  authEvent.useListener((event) => {
    if (event.type !== "authStateChanged") return;
    void navigate(undefined, {
      force: true,
      loadingOptions: {
        loadingMode: () => (event.data.isUserSignedIn ? "sync" : "none"),
        loadingPromise: async () => {
          await event.data.loadPromise;
        },
        style: "bar",
        keyframes: [
          {
            percentage: 90,
            durationMs: 1000,
            text: "Downloading user data...",
          },
        ],
      },
    })
      .catch((error: unknown) => {
        showErrorNotification("Failed to navigate", { error });
      })
      .finally(() => {
        if (!disposed) setAppLoading(false);
      });
  });
  onCleanup(() => {
    disposed = true;
    pending?.resolve();
    for (const request of inFlight) request.resolve();
    for (const resolve of urlReplacements) resolve();
  });

  return null;
}
