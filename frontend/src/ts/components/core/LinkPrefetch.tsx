import { onCleanup, onMount } from "solid-js";
import { envConfig } from "virtual:env-config";

import { getPageForPath } from "../../navigation/routes";
import { preloadPage } from "../pages/lazy-pages";

/** Starts loading a lazy page's code when the user points at or focuses its link. */
export function LinkPrefetch(): null {
  onMount(() => {
    if (envConfig.isDevelopment && !envConfig.devPrefetch) return;
    const prefetch = (event: Event): void => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest("a[router-link]");
      if (!(link instanceof HTMLAnchorElement)) return;
      const url = new URL(link.href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      preloadPage(getPageForPath(url.pathname)).catch(() => {
        // navigation retries the import and reports failures
      });
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
