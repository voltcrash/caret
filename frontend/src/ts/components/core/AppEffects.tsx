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
import { debounce, throttle } from "throttle-debounce";
import { envConfig } from "virtual:env-config";

import { preferencesReadiness } from "../../../app/readiness";
import * as ServerConfiguration from "../../ape/server-configuration";
import { getMutableConfig } from "../../config/store";
import { getAcceptedCookies } from "../../cookies";
import { isInputElementFocused } from "../../input/input-element";
import {
  getMediaQueryDebugLevel,
  isAppLoading,
  isFocusCursorHidden,
} from "../../states/app";
import { addBanner, removeBanner } from "../../states/banners";
import {
  getActivePage,
  getCustomTextIndicator,
  getGlobalOffsetTop,
  getIsScreenshotting,
} from "../../states/core";
import {
  getCrt,
  getFunboxBodyClasses,
  isFunboxReducedMotionIgnored,
} from "../../states/funbox";
import { isModalOpen, showModal } from "../../states/modals";
import { isFixingSkillIssue } from "../../states/skill-issue";
import { getResultVisible, isTestActive } from "../../states/test";
import { getTheme } from "../../states/theme";
import * as Caret from "../../test/caret";
import * as CustomText from "../../test/custom-text";
import * as TestUI from "../../test/test-ui";
import { cn, updateClassNames } from "../../utils/cn";
import { isColorDark } from "../../utils/colors";
import { onDOMReady } from "../../utils/dom-ready";
import { isDevEnvironment } from "../../utils/env";
import { applyReducedMotion } from "../../utils/misc";
import { convertRemToPixels } from "../../utils/numbers";
import { isCoarsePointer } from "../../utils/pointer";
import { canQuickRestart } from "../../utils/quick-restart";
import { BreakpointEvents } from "./BreakpointEvents";
import { GlobalEvents } from "./GlobalEvents";
import { ModifierEvents } from "./ModifierEvents";
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
        return cn(
          body.className
            .split(/\s+/)
            .filter(
              (name) =>
                !name.startsWith("fb-") &&
                ![
                  "loading",
                  "darkMode",
                  "crtmode",
                  "ignore-reduced-motion",
                  "mediaQueryDebugLevel1",
                  "mediaQueryDebugLevel2",
                  "mediaQueryDebugLevel3",
                  "cursor-none",
                  "[&_button]:cursor-none!",
                  "[&_a]:cursor-none!",
                ].includes(name),
            ),
          getFunboxBodyClasses(),
          isColorDark(getTheme().bg) && "darkMode",
          getCrt() !== null && "crtmode",
          isFunboxReducedMotionIgnored() && "ignore-reduced-motion",
          isAppLoading() && "loading",
          isFocusCursorHidden() &&
            "cursor-none [&_a]:cursor-none! [&_button]:cursor-none!",
          getMediaQueryDebugLevel() > 0 &&
            `mediaQueryDebugLevel${getMediaQueryDebugLevel()}`,
        );
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

    const beforeUnload = (event: BeforeUnloadEvent): void => {
      if (
        !canQuickRestart(
          getMutableConfig().mode,
          getMutableConfig().words,
          getMutableConfig().time,
          CustomText.getData(),
          getCustomTextIndicator()?.isLong ?? false,
        ) &&
        isTestActive()
      ) {
        event.preventDefault();
        // Included for legacy support, e.g. Chrome/Edge < 119.
        // oxlint-disable-next-line no-deprecated -- beforeunload returnValue preserves confirmation in legacy browsers.
        event.returnValue = "";
      }
    };

    const timers = new Set<ReturnType<typeof setTimeout>>();
    const debouncedEvent = debounce(250, () => {
      if (getActivePage() === "test" && !getResultVisible()) {
        if (getMutableConfig().tapeMode !== "off") {
          void TestUI.scrollTape();
        } else {
          void TestUI.centerActiveLine();
          void TestUI.updateHintsPositionDebounced();
        }
        const timer = setTimeout(() => {
          timers.delete(timer);
          TestUI.updateWordsInputPosition();
          // on touch, mobile URL bar/keyboard resizes must not reopen the keyboard
          // the user dismissed, so only refocus if the input already has focus
          if (!isCoarsePointer() || isInputElementFocused()) {
            TestUI.focusWords();
          }
          Caret.show();
        }, 250);
        timers.add(timer);
      }
    });
    const throttledEvent = throttle(250, () => Caret.hide());
    const resize = (): void => {
      throttledEvent();
      debouncedEvent();
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("resize", resize);

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
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("resize", resize);
      window.removeEventListener("load", registerServiceWorker);
      debouncedEvent.cancel();
      throttledEvent.cancel();
      for (const timer of timers) clearTimeout(timer);
    });
  });

  return (
    <>
      <OAuthRuntime />
      <GlobalEvents />
      <BreakpointEvents />
      <ModifierEvents />
      <NoCssFallback element={props.noCssWarning} />
    </>
  );
}
