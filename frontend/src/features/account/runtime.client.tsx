import { useQuery } from "@tanstack/solid-query";
import { createEffect, createMemo, on, onCleanup } from "solid-js";

import { requireApplication } from "../../app/application";
import { loadUser, type AccountLoad } from "../../ts/auth";
import { setAuthAvailable } from "../../ts/auth-client";
import * as Sentry from "../../ts/sentry";
import { sessionOptions } from "../auth/session";
import { preloadAccount } from "./page";
import { setLoadedAccount } from "./settled.client";

/**
 * Loads a registered actor's account snapshot, presets, tags, themes,
 * results and server preferences (local → server precedence) once per
 * identity. Unregistered sessions stay in the signup flow. Account state is
 * actor-scoped, so sign-out and account switches drop it automatically.
 */
export function AccountRuntime(): null {
  const account = requireApplication().accountData;
  const session = useQuery(() => sessionOptions());
  createEffect(() => {
    if (session.isSuccess) setAuthAvailable(!import.meta.env.OXYTYPE_OFFLINE);
  });
  const registered = () => {
    const user = session.data?.user;
    return user?.registered === true ? user : undefined;
  };
  // Waits for the session owner to switch the actor, so the load's lease is current.
  const loadable = createMemo(() => {
    const uid = registered()?.uid;
    return uid !== undefined && account.actor() === uid ? uid : undefined;
  });
  createEffect(
    on(loadable, (uid) => {
      const user = registered();
      setLoadedAccount(null);
      if (uid === undefined || user === undefined) {
        // Error reports never keep a signed-out or switched-away identity.
        void Sentry.clearUser();
        return;
      }
      const lease = account.capture();
      const warm = (): void => {
        if (lease.isCurrent()) void preloadAccount().catch(() => undefined);
      };
      if (typeof requestIdleCallback === "function") {
        const idle = requestIdleCallback(warm, { timeout: 2_000 });
        onCleanup(() => cancelIdleCallback(idle));
      } else {
        const idle = setTimeout(warm, 0);
        onCleanup(() => clearTimeout(idle));
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      let wake: (() => void) | undefined;
      onCleanup(() => {
        clearTimeout(timer);
        if (wake !== undefined) window.removeEventListener("online", wake);
      });
      // Back online or after the delay, whichever comes first.
      const retryAfter = async (delay: number): Promise<void> =>
        new Promise((resolve) => {
          wake = () => {
            clearTimeout(timer);
            window.removeEventListener("online", wake as () => void);
            wake = undefined;
            resolve();
          };
          timer = setTimeout(wake, delay);
          window.addEventListener("online", wake);
        });
      void (async () => {
        let result: AccountLoad = await loadUser(user);
        if (lease.isCurrent()) setLoadedAccount(uid);
        for (const delay of retryDelaysMs) {
          if (result !== "unavailable" || !lease.isCurrent()) return;
          await retryAfter(delay);
          if (!lease.isCurrent()) return;
          result = await loadUser(user, { notifyOnFailure: false });
        }
      })();
    }),
  );
  return null;
}

/** Bounded retries for transient account-load failures; no reload loop. */
const retryDelaysMs = [5_000, 15_000, 45_000];
