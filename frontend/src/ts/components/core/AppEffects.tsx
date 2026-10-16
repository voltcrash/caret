import { animate } from "animejs";
import {
  createEffect,
  createSignal,
  JSXElement,
  onCleanup,
  onMount,
  untrack,
} from "solid-js";
import { spread } from "solid-js/web";
import { envConfig } from "virtual:env-config";

import { preferencesReadiness } from "../../../app/readiness";
import * as ServerConfiguration from "../../ape/server-configuration";
import { getAcceptedCookies } from "../../cookies";
import { isAppLoading } from "../../states/app";
import { addBanner, removeBanner } from "../../states/banners";
import { getGlobalOffsetTop, getIsScreenshotting } from "../../states/core";
import { isModalOpen, showModal } from "../../states/modals";
import { isFixingSkillIssue } from "../../states/skill-issue";
import { cn, updateClassNames } from "../../utils/cn";
import { onDOMReady } from "../../utils/dom-ready";
import { isDevEnvironment } from "../../utils/env";
import { applyReducedMotion } from "../../utils/misc";
import { convertRemToPixels } from "../../utils/numbers";
import { bodyClass } from "./body-classes";
import { BreakpointEvents } from "./BreakpointEvents";
import { GlobalEvents } from "./GlobalEvents";
import { NoCssFallback } from "./NoCssFallback";
import { OAuthRuntime } from "./OAuthRuntime";

export type AppElements = {
  element: HTMLElement;
  body: HTMLBodyElement;
  noCssWarning: HTMLElement | null;
};

export function AppEffects(props: AppElements): JSXElement {
  onMount(() => {
    if (!envConfig.devOffline) return;
    const banner = addBanner({
      level: "notice",
      text: "Frontend-only development: authentication and backend requests are disabled.",
    });
    onCleanup(() => removeBanner(banner));
  });
  const [isReady, setReady] = createSignal(false);
  // Bootstrap supplies stable host refs for the lifetime of this root.
  const { element, body } = untrack(() => props);

  // Bind only owned classes/styles; legacy focus/funbox/theme writes still coexist.
  spread(
    element,
    {
      get class() {
        return cn(
          element.className.split(/\s+/).filter((name) => name !== "hidden"),
          !isReady() && "hidden",
        );
      },
      get style() {
        return {
          display: isFixingSkillIssue() ? "none" : undefined,
          // banners already cover the notch, see Banners
          "padding-top":
            getGlobalOffsetTop() > 0
              ? `${getGlobalOffsetTop() + convertRemToPixels(2)}px`
              : "max(2rem, env(safe-area-inset-top, 0px))",
        };
      },
    },
    false,
    true,
  );
  spread(
    body,
    {
      get class() {
        return bodyClass(body.className);
      },
      get style() {
        return {
          transition: isReady() ? "background .25s, transform .05s" : undefined,
        };
      },
    },
    false,
    true,
  );

  onMount(() => {
    // Keep the original animation running while config, auth and the first
    // page settle. Removing it at mount creates a blank frame between loaders.
    const startupScreen = body.querySelector<HTMLElement>("#startupScreen");
    const [isStartupFinished, setStartupFinished] = createSignal(
      startupScreen === null,
    );
    let handoff: ReturnType<typeof animate> | undefined;
    createEffect(() => {
      if (
        handoff !== undefined ||
        !isReady() ||
        (isAppLoading() && !isModalOpen("GoogleSignup"))
      ) {
        return;
      }
      if (startupScreen === null) return;
      // The app is ready: accept input while the cover fades.
      startupScreen.style.pointerEvents = "none";
      handoff = animate(startupScreen, {
        opacity: [1, 0],
        duration: applyReducedMotion(150),
        onComplete: () => {
          startupScreen.remove();
          setStartupFinished(true);
        },
      });
    });
    onCleanup(() => {
      handoff?.cancel();
      startupScreen?.remove();
    });
    let cookiePrompted = false;
    createEffect(() => {
      if (
        cookiePrompted ||
        !isReady() ||
        !isStartupFinished() ||
        isAppLoading() ||
        getAcceptedCookies() !== null
      ) {
        return;
      }
      cookiePrompted = true;
      showModal("Cookies");
    });
    const noscript = body.querySelector<HTMLElement>("noscript");
    createEffect(() => {
      const screenshotting = getIsScreenshotting();
      for (const fallback of [noscript, props.noCssWarning]) {
        if (fallback) {
          fallback.className = updateClassNames(
            fallback.className,
            "hidden",
            screenshotting,
          );
        }
      }
      document.documentElement.style.scrollBehavior = screenshotting
        ? "auto"
        : "smooth";
    });
    if (isDevEnvironment()) document.title = `${document.title} (localhost)`;

    let disposed = false;
    let animation: ReturnType<typeof animate> | undefined;
    const registerServiceWorker = (): void => {
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          console.log(
            "ServiceWorker registration successful with scope: ",
            registration.scope,
          );
        })
        .catch((error: unknown) => {
          console.error("ServiceWorker registration failed: ", error);
        });
    };
    onDOMReady(async () => {
      // Server configuration and authentication are independent startup requests.
      void ServerConfiguration.sync().catch((error: unknown) =>
        console.error("Failed to synchronize server configuration", error),
      );
      await preferencesReadiness().wait();
      if (disposed) return;

      setReady(true);
      animation = animate(element, {
        opacity: [0, 1],
        duration: applyReducedMotion(250),
      });

      if (isDevEnvironment()) {
        void navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => {
            for (const registration of registrations) {
              void registration.unregister();
            }
          });
      } else if ("serviceWorker" in navigator) {
        if (document.readyState === "complete") {
          registerServiceWorker();
        } else {
          window.addEventListener("load", registerServiceWorker, {
            once: true,
          });
        }
      }
    });
    onCleanup(() => {
      disposed = true;
      animation?.cancel();
      window.removeEventListener("load", registerServiceWorker);
    });
  });

  return (
    <>
      <OAuthRuntime />
      <GlobalEvents />
      <BreakpointEvents />
      <NoCssFallback element={props.noCssWarning} />
    </>
  );
}
