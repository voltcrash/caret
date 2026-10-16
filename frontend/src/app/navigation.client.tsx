import { useBlocker, useRouter } from "@tanstack/solid-router";
import { onCleanup } from "solid-js";

import { canNavigate } from "../ts/navigation/guard";
import { bindNavigation } from "../ts/navigation/navigation";

/** Same-origin URL to a Router href; trailing slashes collapse like before. */
export function navigationHref(url: string): string {
  const target = new URL(url === "" ? "/" : url, window.location.origin);
  if (target.origin !== window.location.origin) {
    throw new Error("App navigation requires a same-origin URL");
  }
  return (
    (target.pathname.replace(/\/$/, "") || "/") + target.search + target.hash
  );
}

/**
 * Router owns navigation: links and history traversal pass the test guard as
 * a blocker; command palette, hotkeys and other imperative callers navigate
 * through the same router. `force` skips restart/result checks, never no_quit.
 */
export function RouterNavigation(): null {
  const router = useRouter();
  useBlocker({
    shouldBlockFn: () => !canNavigate(),
    // Router defaults to confirming every document exit while mounted.
    enableBeforeUnload: () => !canNavigate(),
  });
  onCleanup(
    bindNavigation({
      navigate: async (url, options) => {
        if (!canNavigate(options)) return;
        if (url === undefined) {
          await router.invalidate();
          return;
        }
        await router.navigate({
          href: navigationHref(url),
          ignoreBlocker: true,
        });
      },
      replaceUrl: async (url) => {
        await router.navigate({
          href: navigationHref(url),
          replace: true,
          resetScroll: false,
          ignoreBlocker: true,
        });
      },
    }),
  );
  return null;
}
