import { createEffect, onCleanup, onMount } from "solid-js";
import { type JSXElement } from "solid-js";

import { getBrowserEngine } from "../features/typing/engine.client";
import { applyEngineSettings } from "../ts/anim";
import { Theme } from "../ts/components/core/Theme";
import { ThemeEvents } from "../ts/components/core/ThemeEvents";
import { loadFromLocalStorage } from "../ts/config/lifecycle";
import { getMutableConfig } from "../ts/config/store";
import { deactivateAnalytics } from "../ts/controllers/analytics-controller";
import { useThemeEvents } from "../ts/controllers/theme-controller";
import { activateWhatsAccepted, getAcceptedCookies } from "../ts/cookies";
import { disposeSentry, toggleDebug as toggleSentryDebug } from "../ts/sentry";
import { useConnectionEvents } from "../ts/states/connection";
import { enable as glarsesMode } from "../ts/states/glarses-mode";
import { installLogger, toggleDebugLogs } from "../ts/utils/logger";
import { addToGlobal } from "../ts/utils/misc";
import { lockMath } from "./browser-integrity";
import { FontRuntime } from "./font-runtime.client";
import { setChromeReady } from "./startup";

/** Platform/preferences only. Never waits for authentication or account history. */
export default function BrowserRuntime(): JSXElement {
  useThemeEvents();
  useConnectionEvents();
  createEffect(() => {
    getAcceptedCookies();
    activateWhatsAccepted();
  });
  onMount(() => {
    lockMath();
    onCleanup(installLogger());
    onCleanup(
      addToGlobal({
        config: getMutableConfig(),
        glarsesMode,
        toggleDebugLogs,
        toggleSentryDebug,
      }),
    );
    applyEngineSettings();
    // Policies are shared with the typing route; preferences/themes still load
    // independently, and the typing failure UI owns download retry.
    if (window.location.pathname !== "/engine-proof") {
      void getBrowserEngine()
        .load()
        .catch(() => undefined);
    }
    let disposed = false;
    void loadFromLocalStorage()
      .catch((error: unknown) =>
        console.error("Failed to load preferences", error),
      )
      .finally(() => {
        if (!disposed) setChromeReady(true);
      });
    onCleanup(() => {
      disposed = true;
      deactivateAnalytics();
      disposeSentry();
    });
  });
  return (
    <>
      <FontRuntime />
      <Theme />
      <ThemeEvents />
    </>
  );
}
