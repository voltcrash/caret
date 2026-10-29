import { lazy, Show, Suspense } from "solid-js";

import PlatformRuntime from "./platform-runtime.client";
import { isStartupFinished } from "./startup";

const BackgroundRuntime = lazy(async () => import("./background-runtime.client"));

/** Preferences and the engine get the connection before account integrations. */
export default function BrowserRuntime() {
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
