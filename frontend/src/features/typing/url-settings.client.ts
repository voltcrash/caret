import { useLocation } from "@tanstack/solid-router";
import { createEffect, untrack } from "solid-js";

import { createAppOwned } from "../../app/application";
import { preferencesReadiness } from "../../app/readiness";
import { loadBrowserHandoff } from "../../ts/controllers/browser-handoff";
import { applyUrlSettings } from "../../ts/controllers/url-handler";
import { useAccountSettled } from "../account/settled.client";

const applied = createAppOwned(() => ({
  search: undefined as string | undefined,
}));

/**
 * Shared theme/test-settings/challenge links and terminal handoffs on the
 * typing route. Each distinct search applies once, after route entry, local
 * preferences and the account's server preferences, so URL values win like
 * before. Auth refreshes never reapply; signing in only resumes a handoff.
 */
export function useUrlSettings(entered: () => boolean): void {
  // Leaving updates the location before the leaf unmounts; ignore other routes.
  const search = useLocation({
    select: (location) =>
      location.pathname === "/" ? location.searchStr : undefined,
  });
  const signedIn = useAccountSettled();
  createEffect(() => {
    const key = search();
    const registered = signedIn();
    if (
      key === undefined ||
      registered === undefined ||
      !entered() ||
      preferencesReadiness().state().status !== "ready"
    ) {
      return;
    }
    untrack(() => {
      const current = applied();
      // Router re-encodes its search; the raw URL keeps legacy decoding.
      const raw = window.location.search;
      if (current.search !== key) {
        current.search = key;
        if (raw !== "") applyUrlSettings(raw);
        void loadBrowserHandoff(raw, registered);
      } else if (registered) {
        void loadBrowserHandoff(raw, true);
      }
    });
  });
}
