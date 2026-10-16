import {
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  type JSXElement,
} from "solid-js";

import {
  clientBuildId,
  reportStaleClient,
  staleClient,
} from "../../app/release";
import { pendingResultSaves } from "../../app/update-safety";
import { addBanner, removeBanner } from "../../ts/states/banners";
import { showNoticeNotification } from "../../ts/states/notifications";
import {
  isResultCalculating,
  isTestActive,
  isTestRestarting,
} from "../../ts/states/test";
import { isDevEnvironment } from "../../ts/utils/env";
import {
  registerServiceWorker,
  unregisterServiceWorkers,
  type ServiceWorkerUpdates,
} from "./service-worker.client";

/** Updates never interrupt typing, result calculation or a pending save. */
function isUpdateSafe(): boolean {
  return (
    !isTestActive() &&
    !isTestRestarting() &&
    !isResultCalculating() &&
    pendingResultSaves() === 0
  );
}

const versionCheckIntervalMs = 30 * 60 * 1000;
// Chromium, Firefox and Safari wording for a failed dynamic import.
const chunkFailure =
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

/** The deployed build, or undefined when offline/unavailable. */
async function deployedBuild(): Promise<string | undefined> {
  try {
    const response = await fetch("/version.json", { cache: "no-store" });
    if (!response.ok) return undefined;
    const { version } = (await response.json()) as { version?: unknown };
    return typeof version === "string" ? version : undefined;
  } catch {
    return undefined;
  }
}

const bannerText = {
  deployed: "A new version of Oxytype is available.",
  function: "Oxytype was updated and this page is out of date.",
  chunk: "Oxytype was updated and this page is out of date.",
} as const;

/**
 * Owns the service worker and stale-build recovery for one mounted app.
 * A waiting worker for this page's build activates silently once safe; a
 * newer deployment, missing server function or missing chunk shows a reload
 * prompt that refuses to reload during a test or pending result save.
 */
export function UpdateRuntime(props: { reload?: () => void }): JSXElement {
  const [waiting, setWaiting] = createSignal(false);
  const [refreshRequested, setRefreshRequested] = createSignal(false);
  let updates: ServiceWorkerUpdates | undefined;
  let lastCheck = Date.now();
  let disposed = false;
  let fallback: ReturnType<typeof setTimeout> | undefined;

  const checkDeployment = async (reason: "deployed" | "chunk") => {
    lastCheck = Date.now();
    const deployed = await deployedBuild();
    if (disposed || deployed === undefined || deployed === clientBuildId) {
      return deployed;
    }
    reportStaleClient(reason);
    return deployed;
  };

  const reload = (): void => {
    setRefreshRequested(true);
  };
  createEffect(() => {
    if (!refreshRequested() || !isUpdateSafe()) return;
    if (props.reload === undefined) window.location.reload();
    else props.reload();
  });

  const applyUpdate = (): void => {
    if (!isUpdateSafe()) {
      showNoticeNotification(
        "Finish the test and wait for your result to save before reloading.",
        { important: true },
      );
      return;
    }
    if (updates?.activateWaiting(true) === true) {
      // The new worker reloads the page on takeover; never strand the click.
      fallback ??= setTimeout(reload, 3000);
      return;
    }
    reload();
  };
  onCleanup(() => clearTimeout(fallback));

  onMount(() => {
    if (!("serviceWorker" in navigator)) return;
    if (isDevEnvironment()) {
      void unregisterServiceWorkers(navigator.serviceWorker);
      return;
    }
    const registered = registerServiceWorker({
      container: navigator.serviceWorker,
      onWaiting: (value) => {
        if (!value) {
          setWaiting(false);
          return;
        }
        // Classify the waiting build before anything activates.
        void checkDeployment("deployed").then((build) => {
          if (!disposed) setWaiting(build === clientBuildId);
        });
      },
      reload,
      isSafe: isUpdateSafe,
    });
    updates = registered;
    onCleanup(() => registered.dispose());
  });

  onMount(() => {
    if (isDevEnvironment()) return;
    const onVisible = (): void => {
      if (
        document.visibilityState !== "visible" ||
        isTestActive() ||
        Date.now() - lastCheck < versionCheckIntervalMs
      ) {
        return;
      }
      updates?.check();
      void checkDeployment("deployed");
    };
    const onChunkFailure = (): void => {
      void checkDeployment("chunk");
    };
    const onRejection = (event: PromiseRejectionEvent): void => {
      const reason: unknown = event.reason;
      if (reason instanceof Error && chunkFailure.test(reason.message)) {
        onChunkFailure();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("vite:preloadError", onChunkFailure);
    window.addEventListener("unhandledrejection", onRejection);
    onCleanup(() => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("vite:preloadError", onChunkFailure);
      window.removeEventListener("unhandledrejection", onRejection);
    });
  });

  // A worker for this same build only swaps caches; do it between tests.
  createEffect(() => {
    if (waiting() && staleClient() === undefined && isUpdateSafe()) {
      updates?.activateWaiting(false);
    }
  });

  let bannerId: number | undefined;
  createEffect(() => {
    const reason = staleClient();
    if (reason === undefined || bannerId !== undefined || !isUpdateSafe()) {
      return;
    }
    bannerId = addBanner({
      level: reason === "deployed" ? "notice" : "error",
      icon: "fas fa-sync-alt",
      important: reason !== "deployed",
      customContent: (
        <>
          {bannerText[reason]}{" "}
          <button type="button" class="px-2 py-1" onClick={applyUpdate}>
            Reload
          </button>{" "}
          to update.
        </>
      ),
    });
  });
  onCleanup(() => {
    if (bannerId !== undefined) removeBanner(bannerId);
  });

  return null;
}
