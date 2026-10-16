import { onCleanup, onMount } from "solid-js";
import { envConfig } from "virtual:env-config";

import { getPageForPath } from "../../navigation/routes";
import {
  prefetchAboutPage,
  prefetchLeaderboardPage,
} from "../../queries/prefetch";
import { preloadPage } from "../pages/lazy-pages";

/** Rollback only: loads a lazy page's code (and public data) when a link is pointed at or focused. */
export function LinkPrefetch(): null {
  onMount(() => {
    if (envConfig.isDevelopment && !envConfig.devPrefetch) return;
    const prefetch = (event: Event): void => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[router-link]");
      if (!(link instanceof HTMLAnchorElement)) return;
      const url = new URL(link.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      const page = getPageForPath(url.pathname);
      preloadPage(page).catch(() => {
        // navigation retries the import and reports failures
      });
      // Start replaces this with Router intent preload + route loaders.
      if (event.type === "pointerover" && page === "about") prefetchAboutPage();
      if (event.type === "pointerover" && page === "leaderboards") {
        prefetchLeaderboardPage();
      }
    };
    document.addEventListener("pointerover", prefetch, { passive: true });
    document.addEventListener("focusin", prefetch);
    onCleanup(() => {
      document.removeEventListener("pointerover", prefetch);
      document.removeEventListener("focusin", prefetch);
    });
  });
  return null;
}
