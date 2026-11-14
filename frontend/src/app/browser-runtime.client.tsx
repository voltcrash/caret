import { useRouter } from "@tanstack/solid-router";
import { lazy, onCleanup, onMount, Show, Suspense } from "solid-js";

import { canPrefetch } from "./network.client";
import PlatformRuntime from "./platform-runtime.client";
import { isStartupFinished } from "./startup";

const BackgroundRuntime = lazy(
  async () => import("./background-runtime.client"),
);

/** Preferences and the engine get the connection before account integrations. */
export default function BrowserRuntime() {
  const router = useRouter();
  onMount(() => {
    const connection = (navigator as Navigator & { connection?: EventTarget })
      .connection;
    const updatePreload = (): void => {
      router.update({
        context: router.options.context,
        defaultPreload: canPrefetch() ? "intent" : false,
      });
    };
    connection?.addEventListener("change", updatePreload);
    window.addEventListener("online", updatePreload);
    window.addEventListener("offline", updatePreload);
    updatePreload();
    onCleanup(() => {
      connection?.removeEventListener("change", updatePreload);
      window.removeEventListener("online", updatePreload);
      window.removeEventListener("offline", updatePreload);
    });
  });
  return (
    <>
      <PlatformRuntime />
      <Show when={isStartupFinished()}>
        <Suspense>
          <BackgroundRuntime />
        </Suspense>
      </Show>
    </>
  );
}
