import { createEffect, onCleanup, onMount } from "solid-js";
import { type JSXElement } from "solid-js";

import { applyEngineSettings } from "../ts/anim";
import { init, observeAuthSession } from "../ts/auth-client";
import { Theme } from "../ts/components/core/Theme";
import { ThemeEvents } from "../ts/components/core/ThemeEvents";
import { loadFromLocalStorage } from "../ts/config/lifecycle";
import { deactivateAnalytics } from "../ts/controllers/analytics-controller";
import { useThemeEvents } from "../ts/controllers/theme-controller";
import { activateWhatsAccepted, getAcceptedCookies } from "../ts/cookies";
import { disposeSentry } from "../ts/sentry";
import { setVersion } from "../ts/states/core";
import { installLogger } from "../ts/utils/logger";
import { fetchLatestVersion } from "../ts/utils/version";
import { currentApplication, requireApplication } from "./application";
import { lockMath } from "./browser-integrity";
import { FontRuntime } from "./font-runtime.client";
import { authReadiness } from "./readiness";

/** Platform/preferences only. Never waits for authentication or account history. */
export default function BrowserRuntime(props: {
  legacyAuth?: boolean;
}): JSXElement {
  createEffect(() => {
    if (authReadiness().state().status === "ready") {
      onCleanup(observeAuthSession());
    }
  });
  useThemeEvents();
  createEffect(() => {
    getAcceptedCookies();
    activateWhatsAccepted();
  });
  onMount(() => {
    const application = requireApplication();
    let disposed = false;
    onCleanup(() => {
      disposed = true;
    });
    lockMath();
    onCleanup(installLogger());
    applyEngineSettings();
    if (props.legacyAuth !== true) {
      void init(async () => undefined, false).catch((error: unknown) =>
        console.error(error),
      );
    }
    void loadFromLocalStorage().catch((error: unknown) =>
      console.error("Failed to load preferences", error),
    );
    void fetchLatestVersion()
      .then((data) => {
        if (
          !disposed &&
          currentApplication() === application &&
          data !== null
        ) {
          setVersion(data);
        }
      })
      .catch((error: unknown) =>
        console.error("Failed to check version", error),
      );
    onCleanup(() => {
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
